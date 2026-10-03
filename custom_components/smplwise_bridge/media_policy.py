"""Media policy for `smplwise_bridge.execute` (CR-015, bridge 0.4.0; CR-016, bridge 0.5.0): what the bridge accepts for the media services, decided WITHOUT
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
- typed text longer than 200 characters or carrying control characters;
- `remote.send_command` / `remote.turn_on` on an entity whose registry platform is known and is not `androidtv_remote` (a Harmony hub, an
  IR blaster or any other remote platform has activities and commands this policy cannot know), and - whether or not the platform is
  known - an `activity` or a `command` that is a power word (`poweroff`, `power_off`, `standby`, `off`, `turn off`, `shutdown` ... compared
  without case, spaces, dashes and underscores): a Harmony "PowerOff" activity must never ride on an app pick.

CR-016 (bridge 0.5.0) adds the speaker / player / receiver services and is just as strict:

- `music_assistant.play_media` only with a `media_type` of the five (radio, playlist, track, album, artist), an `enqueue` of play / replace / next / add and a
  `media_id` that is a Music Assistant library or provider URI (`scheme://id`) - never an `http(s)://` URL, a `file` path, a bare local path or any scheme that
  fetches a URL - on an entity whose registry platform IS `music_assistant`;
- `music_assistant.transfer_queue` only between two `music_assistant` entities; `music_assistant.play_announcement` and every other announcement never;
- `media_player.join` only with `media_player` entities, a leader and members that all report GROUPING NOW and that belong to ONE layer (all Music
  Assistant, or all the same vendor); `unjoin` only on an entity that reports GROUPING;
- `media_seek` a number between 0 and a day, `shuffle_set` a bool, `repeat_set` off / one / all, `select_sound_mode` a mode in the entity's CURRENT
  `sound_mode_list`;
- never `heos.sign_in` / `sign_out`, `sonos.update_alarm`, `group.set` / `remove` / `reload`, `denonavr.get_command` / `set_dynamic_eq` / `update_audyssey`,
  `cast.show_lovelace_view` or anything of the `jellyfin` domain - an account, alarm or helper-management service is not a player control.

Pure functions: they never read Home Assistant state themselves."""
from __future__ import annotations

import re
from typing import Any, Callable, Mapping

# (domain, service) of every media service this bridge accepts in addition to the older allow-list (mirrored in __init__.ALLOWED_SERVICES)
MEDIA_SERVICES = frozenset({
    ("media_player", "volume_up"), ("media_player", "volume_down"), ("media_player", "media_play_pause"), ("media_player", "media_next_track"),
    ("media_player", "media_previous_track"), ("media_player", "select_source"), ("media_player", "play_media"),
    ("remote", "send_command"), ("remote", "turn_on"), ("webostv", "button"), ("webostv", "select_sound_output"),
    # 0.5.0 (CR-016)
    ("media_player", "media_seek"), ("media_player", "shuffle_set"), ("media_player", "repeat_set"), ("media_player", "select_sound_mode"),
    ("media_player", "join"), ("media_player", "unjoin"), ("music_assistant", "play_media"), ("music_assistant", "transfer_queue"),
})
# refused by name even if someone adds them to another list: they switch power or run free-form commands; 0.5.0: announcements, accounts, alarms, helper management
NEVER_SERVICES = frozenset({
    ("remote", "turn_off"), ("remote", "toggle"), ("webostv", "command"), ("media_player", "toggle"), ("remote", "learn_command"), ("remote", "delete_command"),
    ("music_assistant", "play_announcement"), ("heos", "sign_in"), ("heos", "sign_out"), ("sonos", "update_alarm"), ("group", "set"), ("group", "remove"), ("group", "reload"),
    ("denonavr", "get_command"), ("denonavr", "set_dynamic_eq"), ("denonavr", "update_audyssey"), ("cast", "show_lovelace_view"),
})
NEVER_DOMAINS = frozenset({"jellyfin"})  # a client-session library server is not a player control: no service of it, ever

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
F_GROUPING = 524288  # MediaPlayerEntityFeature.GROUPING
MA_PLATFORM = "music_assistant"
MA_MEDIA_TYPES = ("radio", "playlist", "track", "album", "artist")  # kept equal to services/media_profiles.py MA_MEDIA_TYPES by tests/test_bridge_media_policy.py
MA_ENQUEUE = ("play", "replace", "next", "add")
MA_URI_MAX = 300
BANNED_URI_SCHEMES = frozenset({"http", "https", "file", "ftp", "ftps", "sftp", "ssh", "rtsp", "rtmp", "rtmps", "rtp", "udp", "tcp", "smb", "nfs", "ws", "wss", "data", "javascript", "mms", "url", "builtin"})
MAX_GROUP = 16
SEEK_MAX = 86400
REPEAT_MODES = ("off", "one", "all")
SOUND_MODE_MAX = 80
_URI_RE = re.compile(r"^([a-z][a-z0-9+._-]{0,30})://[^\s\x00-\x1f\x7f]{1,280}$", re.I)
_PLAYER_ENTITY = re.compile(r"^media_player\.[a-z0-9_]{1,200}$")
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
    ("media_player", "media_seek"): frozenset({"seek_position"}), ("media_player", "shuffle_set"): frozenset({"shuffle"}), ("media_player", "repeat_set"): frozenset({"repeat"}),
    ("media_player", "select_sound_mode"): frozenset({"sound_mode"}), ("media_player", "join"): frozenset({"group_members"}), ("media_player", "unjoin"): frozenset(),
    ("music_assistant", "play_media"): frozenset({"media_id", "media_type", "enqueue"}), ("music_assistant", "transfer_queue"): frozenset({"source_player", "auto_play"}),
}
# the entity domain each service's target must have (webostv.* and music_assistant.* target a media_player)
TARGET_DOMAIN: dict[str, str] = {"media_player": "media_player", "remote": "remote", "webostv": "media_player", "music_assistant": "media_player"}

ANDROID_REMOTE_PLATFORM = "androidtv_remote"
POWER_WORDS = frozenset({"poweroff", "powerdown", "poweroffall", "shutdown", "standby", "sleep", "off", "turnoff", "allof", "alloff", "switchoff"})

Attrs = Callable[[str], "Mapping[str, Any] | None"]
Platform = Callable[[str], "str | None"]


def _power_word(value: Any) -> bool:
    """A name that means "switch off" (activity or command): compared lower-case without separators."""
    return isinstance(value, str) and re.sub(r"[\s_\-.]+", "", value.lower()) in POWER_WORDS


def _text_problem(text: Any) -> bool:
    return not isinstance(text, str) or not 1 <= len(text) <= TEXT_MAX or bool(_CONTROL.search(text))


def ma_uri_problem(value: Any) -> bool:
    """True when `value` may NOT be played through Music Assistant: not an `scheme://id` library / provider URI of at most 300 characters without whitespace,
    control characters or `..`, or a scheme that fetches a URL or reads a file (`http(s)`, `file`, `url` ...)."""
    if not isinstance(value, str) or not 1 <= len(value) <= MA_URI_MAX:
        return True
    m = _URI_RE.match(value)
    return m is None or m.group(1).lower() in BANNED_URI_SCHEMES or ".." in value or "%2e%2e" in value.lower()


def _grouping(entity_id: str, attributes_of: Attrs) -> bool:
    """The entity reports GROUPING NOW (the feature mask is in its state attributes)."""
    attrs = attributes_of(entity_id)
    mask = (attrs or {}).get("supported_features")
    return isinstance(mask, int) and not isinstance(mask, bool) and bool(mask & F_GROUPING)


def _listed(value: Any, attrs: Mapping[str, Any] | None, key: str, longest: int) -> bool:
    items = (attrs or {}).get(key)
    return isinstance(value, str) and 0 < len(value) <= longest and isinstance(items, (list, tuple)) and value in items


def refusal(domain: str, service: str, data: Any, attributes_of: Attrs, platform_of: Platform | None = None) -> str | None:
    """None when a media call may go on, else a fixed refusal code. `data` is the service data of the signed call (with `entity_id`);
    `attributes_of(entity_id)` returns that entity's CURRENT state attributes (None when it cannot be read); `platform_of(entity_id)` (optional)
    its registry platform - when given and known, `remote.*` calls are bound to `androidtv_remote`. Services outside the media set are
    not judged here (returns None): the caller checks `is_media` first."""
    pair = (domain, service)
    if pair in NEVER_SERVICES or domain in NEVER_DOMAINS:
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
    if domain == "remote" and platform_of is not None:
        platform = platform_of(entity_id)
        if platform is not None and platform != ANDROID_REMOTE_PLATFORM:
            return "media_entity"  # only an Android TV remote has the closed command table and activity list this policy knows
    if pair == ("remote", "send_command"):
        command = data.get("command")
        if not isinstance(command, str):  # a list of commands could carry a power key
            return "media_key_refused"
        if command.startswith("text:"):
            return "media_text_refused" if _text_problem(command[5:]) else None
        if _power_word(command):
            return "media_key_refused"
        return None if command in ANDROID_KEYS else "media_key_refused"
    if pair == ("webostv", "button"):
        return None if isinstance(data.get("button"), str) and data["button"] in LG_BUTTONS else "media_key_refused"
    if pair == ("webostv", "select_sound_output"):
        value = data.get("sound_output")
        return None if isinstance(value, str) and SOUND_OUTPUT_RE.match(value) else "media_arguments"
    if pair == ("media_player", "select_source"):
        return None if _listed(data.get("source"), attributes_of(entity_id), "source_list", SOURCE_MAX) else "media_source_not_listed"
    # ---- 0.5.0 (CR-016)
    if pair == ("media_player", "media_seek"):
        pos = data.get("seek_position")
        return None if isinstance(pos, (int, float)) and not isinstance(pos, bool) and pos == pos and 0 <= pos <= SEEK_MAX else "media_arguments"
    if pair == ("media_player", "shuffle_set"):
        return None if isinstance(data.get("shuffle"), bool) else "media_arguments"
    if pair == ("media_player", "repeat_set"):
        return None if data.get("repeat") in REPEAT_MODES else "media_arguments"
    if pair == ("media_player", "select_sound_mode"):
        mode = data.get("sound_mode")
        return None if isinstance(mode, str) and 0 < len(mode) <= SOUND_MODE_MAX and not _CONTROL.search(mode) and _listed(mode, attributes_of(entity_id), "sound_mode_list", SOUND_MODE_MAX) else "media_sound_mode_not_listed"
    if pair == ("media_player", "unjoin"):
        return None if _grouping(entity_id, attributes_of) else "media_group_refused"
    if pair == ("media_player", "join"):
        members = data.get("group_members")
        if not isinstance(members, (list, tuple)) or not 1 <= len(members) <= MAX_GROUP - 1 or len(set(members)) != len(members):
            return "media_arguments"
        if any(not isinstance(m, str) or not _PLAYER_ENTITY.match(m) for m in members) or entity_id in members:
            return "media_group_refused"
        everyone = [entity_id, *members]
        if not all(_grouping(e, attributes_of) for e in everyone):
            return "media_group_refused"  # a member that cannot group right now (a Cast entity never can) is not offered a join
        if platform_of is not None:
            layers = {platform_of(e) for e in everyone}
            if len(layers) > 1:
                return "media_group_refused"  # ONE layer per group: all Music Assistant, or all the same vendor - never a mix
        return None
    if pair == ("music_assistant", "play_media"):
        if data.get("media_type") not in MA_MEDIA_TYPES or data.get("enqueue", "play") not in MA_ENQUEUE or "media_id" not in data:
            return "media_arguments"
        if ma_uri_problem(data.get("media_id")):
            return "media_uri_refused"
        return None if platform_of is not None and platform_of(entity_id) == MA_PLATFORM else "media_entity"
    if pair == ("music_assistant", "transfer_queue"):
        source = data.get("source_player")
        if not isinstance(source, str) or not _PLAYER_ENTITY.match(source) or source == entity_id or ("auto_play" in data and not isinstance(data["auto_play"], bool)):
            return "media_arguments"
        if platform_of is None or platform_of(entity_id) != MA_PLATFORM or platform_of(source) != MA_PLATFORM:
            return "media_entity"  # between two Music Assistant players only
        return None
    if pair == ("remote", "turn_on"):
        if "activity" not in data:
            return "media_arguments"  # a bare remote.turn_on is a power-on of the device: never through this service
        if _power_word(data.get("activity")):
            return "media_activity_not_listed"  # an activity that switches things off is not an app pick, listed or not
        return None if _listed(data.get("activity"), attributes_of(entity_id), "activity_list", ACTIVITY_MAX) else "media_activity_not_listed"
    return None  # the argument-free steps (volume_up / down, play_pause, next, previous)


def is_media(domain: str, service: str) -> bool:
    return (domain, service) in MEDIA_SERVICES or (domain, service) in NEVER_SERVICES or domain in NEVER_DOMAINS


# ---- the read-only `smplwise_bridge.media_query` service (0.5.0): what it may be asked, decided here and nowhere else
QUERY_KINDS = ("queue", "library", "search")
SEARCH_LIMIT_MAX = 50
SEARCH_TEXT_MAX = 60
LIBRARY_ORDER = ("name", "last_played", "timestamp_added")
LIBRARY_LIMIT_MAX = 100
LIBRARY_OFFSET_MAX = 5000


def query_refusal(query: Any, fields: Mapping[str, Any]) -> str | None:
    """None when this `media_query` may be asked, else a fixed refusal code (`query_not_allowed`, `arguments_invalid`). `queue`: ONE media_player entity (the
    service then answers only for a Music Assistant or a Sonos one). `library`: a media type of the five, `favorite` a bool, `limit` 1-100, `offset` 0-5000,
    `order_by` name / last_played / timestamp_added and, optionally, the player whose music layer is asked (it selects the provider: Music Assistant or a Sonos
    player's own favourites) - and NO config entry, ever (the bridge finds the loaded Music Assistant entry itself; a caller never supplies one) and no
    free-form search. 0.7.0 adds `search`: a text (1-60 printable characters), one media type, `limit` 1-50 and the optional player - still no
    config entry; the library of the loaded Music Assistant entry only."""
    if query not in QUERY_KINDS:
        return "query_not_allowed"
    allowed = {"queue": {"entity_id"}, "library": {"entity_id", "media_type", "favorite", "limit", "offset", "order_by"},
               "search": {"entity_id", "media_type", "name", "limit"}}[query]
    if set(map(str, fields)) - allowed:
        return "arguments_invalid"
    entity_id = fields.get("entity_id")
    if (query == "queue" or "entity_id" in fields) and (not isinstance(entity_id, str) or not _PLAYER_ENTITY.match(entity_id)):
        return "arguments_invalid"
    if query == "queue":
        return None
    if fields.get("media_type") not in MA_MEDIA_TYPES:
        return "arguments_invalid"
    if "favorite" in fields and not isinstance(fields["favorite"], bool):
        return "arguments_invalid"
    if query == "search":  # 0.7.0: a text of 1-60 printable characters, one media type, at most 50 hits; the library of the loaded Music Assistant entry only
        name, limit = fields.get("name"), fields.get("limit", SEARCH_LIMIT_MAX)
        if not isinstance(name, str) or not name.strip() or len(name) > SEARCH_TEXT_MAX or any(ord(c) < 32 or ord(c) == 127 for c in name):
            return "arguments_invalid"
        return None if isinstance(limit, int) and not isinstance(limit, bool) and 1 <= limit <= SEARCH_LIMIT_MAX else "arguments_invalid"
    for key, top in (("limit", LIBRARY_LIMIT_MAX), ("offset", LIBRARY_OFFSET_MAX)):
        value = fields.get(key)
        if key in fields and (isinstance(value, bool) or not isinstance(value, int) or not (1 if key == "limit" else 0) <= value <= top):
            return "arguments_invalid"
    if "order_by" in fields and fields["order_by"] not in LIBRARY_ORDER:
        return "arguments_invalid"
    return None
