"""The thin HA bridge protocol (ADR-012): a pairing secret shared once between the add-on and the
`smplwise_bridge` custom integration, then per-message HMAC (timestamp + nonce + body hash).

- Actions: the add-on signs `{user_id, domain, service, data, request_id}` and calls the integration's
  `execute` service; the integration verifies the signature and re-issues the HA service call with
  `Context(user_id=…)`, so HA's own per-user entity permissions apply. The add-on token alone never acts
  as a user (chapter 8).
- Directory: the integration pushes the HA user list to the add-on (`POST /api/v1/ha/bridge/directory`),
  signed the same way, for the user/role screens.

Allow-listed actions are the only writes the product knows; arguments are validated here. An action with a
`grant` (lock.unlock -> door.unlock) needs that separate permission on top of ha.entity.control (T079)."""
from __future__ import annotations

import hashlib
import hmac
import json
import math
import re
import secrets
import sqlite3
import time
from typing import Any

from ..db import get_setting, set_setting
from ..errors import ApiError
from . import media_profiles

SIGNATURE_WINDOW_S = 60
_recent_nonces: dict[str, float] = {}


def signing_key(conn: sqlite3.Connection) -> str | None:
    return get_setting(conn, "bridge.secret")


def ensure_pairing(conn: sqlite3.Connection, regenerate: bool = False) -> str:
    """Create (once) the pairing secret the admin types into the integration's config flow."""
    secret = get_setting(conn, "bridge.secret")
    if not secret or regenerate:
        secret = secrets.token_urlsafe(24)
        set_setting(conn, "bridge.secret", secret)
        set_setting(conn, "bridge.paired_at", "")
    return secret


def sign(secret: str, body: dict[str, Any], ts: int | None = None, nonce: str | None = None) -> dict[str, Any]:
    """Canonical JSON of `body` + ts + nonce, HMAC-SHA256 with the pairing secret."""
    ts = ts or int(time.time())
    nonce = nonce or secrets.token_hex(8)
    canonical = json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    digest = hmac.new(secret.encode(), f"{ts}.{nonce}.{hashlib.sha256(canonical.encode()).hexdigest()}".encode(), hashlib.sha256).hexdigest()
    return {**body, "ts": ts, "nonce": nonce, "sig": digest}


def verify(secret: str | None, message: dict[str, Any], now: float | None = None) -> None:
    """Raises ApiError(401) unless the signature is valid, recent and unseen."""
    if not secret:
        raise ApiError(401, "bridge_not_paired", "הגשר לא צומד עדיין.")
    try:
        ts, nonce, sig = int(message.get("ts", 0)), str(message.get("nonce", "")), str(message.get("sig", ""))
    except (TypeError, ValueError):
        raise ApiError(401, "bridge_bad_signature", "חתימה לא תקינה.")
    now = now or time.time()
    if abs(now - ts) > SIGNATURE_WINDOW_S or not nonce:
        raise ApiError(401, "bridge_stale", "ההודעה מהגשר ישנה מדי.")
    body = {k: v for k, v in message.items() if k not in ("ts", "nonce", "sig")}
    expected = sign(secret, body, ts, nonce)["sig"]
    if not hmac.compare_digest(expected, sig):
        raise ApiError(401, "bridge_bad_signature", "חתימת הגשר לא תואמת.")
    # replay protection within the window
    for n, t in list(_recent_nonces.items()):
        if now - t > SIGNATURE_WINDOW_S * 2:
            _recent_nonces.pop(n, None)
    if nonce in _recent_nonces:
        raise ApiError(401, "bridge_replay", "הודעה חוזרת.")
    _recent_nonces[nonce] = now


# ---------------------------------------------------------------- allow-listed actions

# Risk classes (T040): "routine" runs at once; "attention" needs an explicit confirmation (side effects the VMS
# cannot see: scripts, scenes, buttons, sirens, arming, covers); "sensitive" needs its own grant on top of entity
# control (never implied by a role) and a confirmation. `sensitive` (bool) stays for the older clients: it is
# True for attention and sensitive alike.
RISK_LABEL = {"routine": "שגרתית", "attention": "דורשת אישור", "sensitive": "רגישה — הרשאה נפרדת"}
HVAC_MODES = ["off", "heat", "cool", "heat_cool", "auto", "dry", "fan_only"]
TEMPERATURE_BOUNDS = (-30, 120)  # outer sanity bounds of a climate target (either unit); the entity's own range decides
TEMPERATURE_DEFAULT_RANGE = (5.0, 35.0)  # for a climate entity that reports no min_temp / max_temp


def _a(domain: str, service: str, label: str, *, args: dict[str, Any] | None = None, expect: str | None = None, risk: str = "routine", grant: str | None = None, expect_from: str | None = None,
       expect_attr: tuple[str, str | None, float | str | None] | None = None, route: str | None = None, entity_domain: str | None = None, required: tuple[str, ...] = (),
       window_s: float | None = None, always_expect: bool = False) -> dict[str, Any]:
    d: dict[str, Any] = {"domain": domain, "service": service, "args": args or {}, "expect": expect, "sensitive": risk != "routine", "risk": risk, "label": label}
    if grant:
        d["grant"] = grant
    if route:
        # CR-015: `route: "media"` actions are sent ONLY by the multimedia commands route (services/media_commands.py); the generic
        # entity-action route and the entity catalogue never offer them (routers/ha.py use_media_screen)
        d["route"] = route
    if entity_domain:
        d["entity_domain"] = entity_domain  # the service's domain differs from its target entity's (webostv.* targets a media_player)
    if required:
        d["required"] = list(required)
    if window_s:
        d["window_s"] = window_s  # CR-016: how long the confirming report is awaited (a group's membership is read back for 8 s, not 20)
    if always_expect:
        d["always_expect"] = True  # CR-016: confirmed from the attribute even when it is absent / null now (a HEOS player's `group_members` is null while ungrouped)
    if expect_from:
        d["expect_from"] = expect_from
    if expect_attr:
        # CR-007 slice 2 review: an action whose effect is not the entity's state (a cover's position, a fan's
        # percentage, a climate target/fan mode, a player's mute) is confirmed from the attribute that reports it,
        # never by comparing the state to the argument ("40" is never a cover's state). (attribute, argument,
        # tolerance): a number, None for an exact match, or the name of an attribute holding the device's own step.
        d["expect_attr"] = {"attribute": expect_attr[0], "argument": expect_attr[1], "tolerance": expect_attr[2]}
    return d


ACTIONS: dict[str, dict[str, Any]] = {
    # id: domain, service, argument schema {name: (type, lo, hi) | ("enum", choices) | ("str", min_len, max_len)},
    # expected state after success (or the argument it comes from), risk class, extra grant
    "light.turn_on": _a("light", "turn_on", "הדלקה", args={"brightness_pct": ("int", 1, 100)}, expect="on"),
    "light.turn_off": _a("light", "turn_off", "כיבוי", expect="off"),
    "switch.turn_on": _a("switch", "turn_on", "הדלקה", expect="on"),
    "switch.turn_off": _a("switch", "turn_off", "כיבוי", expect="off"),
    "fan.turn_on": _a("fan", "turn_on", "הפעלה", args={"percentage": ("int", 1, 100)}, expect="on"),
    "fan.turn_off": _a("fan", "turn_off", "כיבוי", expect="off"),
    "fan.set_percentage": _a("fan", "set_percentage", "עוצמת מאוורר", args={"percentage": ("int", 0, 100)}, expect_attr=("percentage", "percentage", "percentage_step")),
    "cover.open_cover": _a("cover", "open_cover", "פתיחה", expect="open", risk="attention"),
    "cover.close_cover": _a("cover", "close_cover", "סגירה", expect="closed", risk="attention"),
    "cover.stop_cover": _a("cover", "stop_cover", "עצירה"),
    # one physical movement whichever control starts it: the same "attention" risk as open/close (coordinator ruling,
    # CR-007 s7), so the UI arms-then-confirms on the slider release and the server insists on the confirmation
    "cover.set_cover_position": _a("cover", "set_cover_position", "מיקום", args={"position": ("int", 0, 100)}, risk="attention", expect_attr=("current_position", "position", 2)),
    "lock.lock": _a("lock", "lock", "נעילה", expect="locked"),
    "lock.unlock": _a("lock", "unlock", "פתיחה", expect="unlocked", risk="sensitive", grant="door.unlock"),
    "button.press": _a("button", "press", "לחיצה", risk="attention"),
    "script.turn_on": _a("script", "turn_on", "הפעלת סקריפט", risk="attention"),
    "scene.turn_on": _a("scene", "turn_on", "הפעלת סצנה", risk="attention"),
    # T040: more adapters
    "climate.set_hvac_mode": _a("climate", "set_hvac_mode", "מצב פעולה", args={"hvac_mode": ("enum", HVAC_MODES)}, expect_from="hvac_mode"),
    # The static bounds are only an outer sanity check: a climate entity is not always an air conditioner (a heating
    # thermostat, a boiler or a heat pump targets 45 C and its own max_temp says 95), so the real range is the
    # entity's own min_temp / max_temp (check_entity_range), with TEMPERATURE_DEFAULT_RANGE for one that reports none.
    "climate.set_temperature": _a("climate", "set_temperature", "טמפרטורת יעד", args={"temperature": ("float", TEMPERATURE_BOUNDS[0], TEMPERATURE_BOUNDS[1])}, expect_attr=("temperature", "temperature", 0.05)),
    # CR-007 slice 2: the devices area's climate card (mode/target already covered by set_hvac_mode/set_temperature above)
    "climate.set_fan_mode": _a("climate", "set_fan_mode", "מצב מאוורר", args={"fan_mode": ("str", 1, 40)}, expect_attr=("fan_mode", "fan_mode", None)),
    "climate.turn_off": _a("climate", "turn_off", "כיבוי מיזוג", expect="off"),
    # CR-007 slice 4: climate/covers in full - preset, swing and target humidity (an entity offers only the modes /
    # feature it reports; the devices-area card reads hvac_modes / fan_modes / preset_modes / swing_modes / min-max
    # from the entity itself, never assumes a fixed set)
    "climate.set_preset_mode": _a("climate", "set_preset_mode", "מצב מוגדר מראש", args={"preset_mode": ("str", 1, 40)}, expect_attr=("preset_mode", "preset_mode", None)),
    "climate.set_swing_mode": _a("climate", "set_swing_mode", "מצב נדנוד", args={"swing_mode": ("str", 1, 40)}, expect_attr=("swing_mode", "swing_mode", None)),
    "climate.set_humidity": _a("climate", "set_humidity", "לחות יעד", args={"humidity": ("int", 0, 100)}, expect_attr=("humidity", "humidity", 1)),
    "humidifier.set_humidity": _a("humidifier", "set_humidity", "לחות יעד", args={"humidity": ("int", 0, 100)}, expect_attr=("humidity", "humidity", 1)),
    "humidifier.set_mode": _a("humidifier", "set_mode", "מצב לחות", args={"mode": ("str", 1, 40)}, expect_attr=("mode", "mode", None)),
    # CR-007 slice 4: cover tilt - open/close/stop carry the same "attention" risk as the top movement (coordinator
    # ruling, CR-007 s7.8: one physical movement whichever control starts it); nothing observable confirms open/close
    # tilt (the cover's own `state` reflects the position, not the tilt - honestly "sent", never "confirmed", the same
    # treatment stop_cover already gets); the position slider is confirmed from current_tilt_position, like the top one.
    "cover.open_cover_tilt": _a("cover", "open_cover_tilt", "פתיחת הטיה", risk="attention"),
    "cover.close_cover_tilt": _a("cover", "close_cover_tilt", "סגירת הטיה", risk="attention"),
    "cover.stop_cover_tilt": _a("cover", "stop_cover_tilt", "עצירת הטיה"),
    "cover.set_cover_tilt_position": _a("cover", "set_cover_tilt_position", "מיקום הטיה", args={"tilt_position": ("int", 0, 100)}, risk="attention", expect_attr=("current_tilt_position", "tilt_position", 2)),
    "media_player.media_play": _a("media_player", "media_play", "נגן", expect="playing"),
    "media_player.media_pause": _a("media_player", "media_pause", "השהה", expect="paused"),
    "media_player.media_stop": _a("media_player", "media_stop", "עצור"),
    "media_player.volume_set": _a("media_player", "volume_set", "עוצמת שמע", args={"volume_level": ("float", 0, 1)}, expect_attr=("volume_level", "volume_level", 0.01)),
    "media_player.volume_mute": _a("media_player", "volume_mute", "השתקה", args={"is_volume_muted": ("bool",)}, expect_attr=("is_volume_muted", "is_volume_muted", None)),
    "media_player.turn_on": _a("media_player", "turn_on", "הדלקה", expect="on"),
    "media_player.turn_off": _a("media_player", "turn_off", "כיבוי", expect="off"),
    "number.set_value": _a("number", "set_value", "קביעת ערך", args={"value": ("float", -1e9, 1e9)}, expect_from="value"),
    "input_number.set_value": _a("input_number", "set_value", "קביעת ערך", args={"value": ("float", -1e9, 1e9)}, expect_from="value"),
    "select.select_option": _a("select", "select_option", "בחירה", args={"option": ("str", 1, 80)}, expect_from="option"),
    "input_select.select_option": _a("input_select", "select_option", "בחירה", args={"option": ("str", 1, 80)}, expect_from="option"),
    "input_boolean.turn_on": _a("input_boolean", "turn_on", "הפעלה", expect="on"),
    "input_boolean.turn_off": _a("input_boolean", "turn_off", "כיבוי", expect="off"),
    "vacuum.start": _a("vacuum", "start", "התחל ניקוי", expect="cleaning"),
    "vacuum.return_to_base": _a("vacuum", "return_to_base", "חזרה לעמדה", expect="returning"),
    "siren.turn_on": _a("siren", "turn_on", "הפעלת צופר", expect="on", risk="attention"),
    "siren.turn_off": _a("siren", "turn_off", "כיבוי צופר", expect="off"),
    "alarm_control_panel.alarm_arm_home": _a("alarm_control_panel", "alarm_arm_home", "דריכה בבית", expect="armed_home", risk="attention"),
    "alarm_control_panel.alarm_arm_away": _a("alarm_control_panel", "alarm_arm_away", "דריכה מלאה", expect="armed_away", risk="attention"),
    "alarm_control_panel.alarm_disarm": _a("alarm_control_panel", "alarm_disarm", "נטרול", expect="disarmed", risk="sensitive", grant="alarm.disarm"),
    # CR-010 (the alarm section): the other arm modes a panel may offer (supported_features ARM_NIGHT / ARM_VACATION /
    # ARM_CUSTOM_BYPASS). Trigger is never allow-listed. The panel's code is never an argument here: the alarm route
    # (routers/alarm.py) adds it to the service data only, so it never reaches ha_actions.arguments_json or the audit.
    "alarm_control_panel.alarm_arm_night": _a("alarm_control_panel", "alarm_arm_night", "דריכת לילה", expect="armed_night", risk="attention"),
    "alarm_control_panel.alarm_arm_vacation": _a("alarm_control_panel", "alarm_arm_vacation", "דריכת חופשה", expect="armed_vacation", risk="attention"),
    "alarm_control_panel.alarm_arm_custom_bypass": _a("alarm_control_panel", "alarm_arm_custom_bypass", "דריכה עם עקיפה", expect="armed_custom_bypass", risk="attention"),
    # CR-015 (multimedia, MEDIA_API.md 5.2): what the remote needs beyond the rows above. Every one is `route: "media"`: it is
    # sent only by POST /multimedia/devices/{key}/commands, which resolves the endpoint, the profile code and the permission;
    # the generic route refuses them (409 use_media_screen) and the catalogue never lists them. No power key, no
    # `remote.turn_off`, no `webostv.command`, no other `play_media` type exists here.
    "media_player.volume_up": _a("media_player", "volume_up", "עוצמה למעלה", route="media"),
    "media_player.volume_down": _a("media_player", "volume_down", "עוצמה למטה", route="media"),
    "media_player.media_play_pause": _a("media_player", "media_play_pause", "נגן / השהה", route="media"),
    "media_player.media_next_track": _a("media_player", "media_next_track", "הבא", route="media"),
    "media_player.media_previous_track": _a("media_player", "media_previous_track", "הקודם", route="media"),
    "media_player.select_source": _a("media_player", "select_source", "החלפת מקור", args={"source": ("str", 1, 120)}, expect_attr=("source", "source", None), route="media", required=("source",)),
    "media_player.play_media": _a("media_player", "play_media", "שליחת מקש / טקסט", args={"media_content_type": ("enum", ["send_key", "send_text"]), "media_content_id": ("str", 1, 200)}, route="media",
                                  required=("media_content_type", "media_content_id")),
    "remote.send_command": _a("remote", "send_command", "שליחת מקש", args={"command": ("str", 1, 205)}, route="media", required=("command",)),
    "remote.turn_on": _a("remote", "turn_on", "הפעלת אפליקציה", args={"activity": ("str", 1, 200)}, expect_attr=("current_activity", "activity", None), route="media", required=("activity",)),
    "webostv.button": _a("webostv", "button", "שליחת מקש", args={"button": ("enum", sorted(media_profiles.ALL_LG))}, route="media", entity_domain="media_player", required=("button",)),
    "webostv.select_sound_output": _a("webostv", "select_sound_output", "יציאת שמע", args={"sound_output": ("str", 1, 40)}, expect_attr=("sound_output", "sound_output", None), route="media",
                                      entity_domain="media_player", required=("sound_output",)),
    # CR-016 (players, speakers, groups; MEDIA_PLAYERS_API.md 3.y): what a speaker, player or receiver card needs beyond the rows above. Again
    # `route: "media"` only (the multimedia commands and group routes send them; the generic route refuses them). `music_assistant.play_media` plays
    # an item the SERVER listed (an MA library / provider URI, never a URL); `play_announcement` is NOT here (no announcements in 0.1.150), neither
    # are `heos.sign_in` / `sign_out`, `sonos.update_alarm`, `group.set` / `remove` / `reload`, `denonavr.get_command` / `set_dynamic_eq` /
    # `update_audyssey`, `jellyfin.*` or `cast.show_lovelace_view`.
    "media_player.media_seek": _a("media_player", "media_seek", "קפיצה בשיר", args={"seek_position": ("float", 0, 86400)}, expect_attr=("media_position", "seek_position", 5.0), route="media", required=("seek_position",)),
    "media_player.shuffle_set": _a("media_player", "shuffle_set", "ערבוב", args={"shuffle": ("bool",)}, expect_attr=("shuffle", "shuffle", None), route="media", required=("shuffle",)),
    "media_player.repeat_set": _a("media_player", "repeat_set", "חזרה", args={"repeat": ("enum", ["off", "one", "all"])}, expect_attr=("repeat", "repeat", None), route="media", required=("repeat",)),
    "media_player.select_sound_mode": _a("media_player", "select_sound_mode", "מצב צליל", args={"sound_mode": ("str", 1, 80)}, expect_attr=("sound_mode", "sound_mode", None), route="media", required=("sound_mode",)),
    "media_player.join": _a("media_player", "join", "צירוף לקבוצה", args={"group_members": ("entities", 1, 16)}, expect_attr=("group_members", "group_members", "superset"), route="media",
                            required=("group_members",), window_s=8.0, always_expect=True),
    "media_player.unjoin": _a("media_player", "unjoin", "יציאה מקבוצה", expect_attr=("group_members", None, "ungrouped"), route="media", window_s=8.0, always_expect=True),
    "music_assistant.play_media": _a("music_assistant", "play_media", "ניגון פריט מהספרייה", args={"media_id": ("str", 1, 300), "media_type": ("enum", ["radio", "playlist", "track", "album", "artist"]),
                                                                                               "enqueue": ("enum", ["play", "replace", "next", "add"])}, route="media", entity_domain="media_player",
                                     required=("media_id", "media_type")),
    "music_assistant.transfer_queue": _a("music_assistant", "transfer_queue", "העברת המוזיקה", args={"source_player": ("str", 1, 255), "auto_play": ("bool",)}, route="media", entity_domain="media_player",
                                         required=("source_player",)),
}

# CR-016: the actions that change a player's group - confirmed by reading the membership back (8 s), outcome per device (services/media_groups.py)
MEMBERSHIP_ACTIONS = frozenset({"media_player.join", "media_player.unjoin"})
ENTITY_ID_RE = re.compile(r"^media_player\.[a-z0-9_]{1,200}$")


def _arg_spec(name: str, schema: tuple[Any, ...]) -> dict[str, Any]:
    typ = schema[0]
    if typ == "enum":
        return {"name": name, "type": "enum", "choices": list(schema[1])}
    if typ == "str":
        return {"name": name, "type": "str", "min_len": schema[1], "max_len": schema[2]}
    if typ == "entities":
        return {"name": name, "type": "entities", "min_len": schema[1], "max_len": schema[2]}
    if typ == "bool":
        return {"name": name, "type": "bool"}
    return {"name": name, "type": typ, "min": schema[1], "max": schema[2]}


def actions_for(domain: str) -> list[dict[str, Any]]:
    return [
        {"id": aid, "label": a["label"], "sensitive": a["sensitive"], "risk": a["risk"], "risk_label": RISK_LABEL[a["risk"]], "arguments": list(a["args"]),
         "argument_specs": [_arg_spec(n, sc) for n, sc in a["args"].items()], "grant": a.get("grant")}
        for aid, a in ACTIONS.items() if a["domain"] == domain and not a.get("route")  # CR-015: a `route` action is never offered generically
    ]


def validate_action(action_id: str, entity_id: str, arguments: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    """Returns (action definition, cleaned service data) or raises 422."""
    spec = ACTIONS.get(action_id)
    if not spec:
        raise ApiError(422, "action_not_allowed", "פעולה זו אינה ברשימת הפעולות המאושרות.", details={"action": action_id})
    if entity_id.split(".", 1)[0] != spec.get("entity_domain", spec["domain"]):
        raise ApiError(422, "action_domain_mismatch", "הפעולה אינה מתאימה לסוג הישות.", details={"action": action_id, "entity": entity_id})
    data: dict[str, Any] = {"entity_id": entity_id}
    for name, value in (arguments or {}).items():
        if name not in spec["args"]:
            raise ApiError(422, "argument_not_allowed", f"ארגומנט לא מאושר: {name}", details={"argument": name})
        schema = spec["args"][name]
        typ = schema[0]
        if typ in ("int", "float"):
            lo, hi = schema[1], schema[2]
            try:
                num = int(value) if typ == "int" else float(value)
            except (TypeError, ValueError):
                raise ApiError(422, "validation", f"{name} חייב להיות מספר.")
            if isinstance(value, bool) or num != num:  # bools and NaN never pass as numbers
                raise ApiError(422, "validation", f"{name} חייב להיות מספר.")
            if not lo <= num <= hi:
                raise ApiError(422, "validation", f"{name} מחוץ לטווח {lo}–{hi}.")
            data[name] = num
        elif typ == "enum":
            if not isinstance(value, str) or value not in schema[1]:
                raise ApiError(422, "validation", f"{name}: ערך לא מוכר.", details={"choices": list(schema[1])})
            data[name] = value
        elif typ == "str":
            if not isinstance(value, str) or not schema[1] <= len(value.strip()) <= schema[2]:
                raise ApiError(422, "validation", f"{name}: טקסט באורך {schema[1]}–{schema[2]} תווים.")
            data[name] = value.strip()
        elif typ == "bool":
            if not isinstance(value, bool):
                raise ApiError(422, "validation", f"{name} חייב להיות אמת/שקר.")
            data[name] = value
        elif typ == "entities":
            ok = isinstance(value, list) and schema[1] <= len(value) <= schema[2] and all(isinstance(x, str) and ENTITY_ID_RE.match(x) for x in value) and len(set(value)) == len(value)
            if not ok:
                raise ApiError(422, "validation", f"{name}: רשימה של {schema[1]}–{schema[2]} ישויות נגן שונות.")
            data[name] = list(value)
    ea = spec.get("expect_attr")
    missing = [n for n in spec["args"] if n not in data and (spec.get("expect_from") == n or (ea and ea["argument"] == n) or n in spec.get("required", ()))]
    if missing:
        raise ApiError(422, "validation", f"חסר ארגומנט: {missing[0]}", details={"argument": missing[0]})
    if spec.get("route") == "media":
        reason = media_profiles.static_refusal(action_id, data)  # CR-015: a key code outside the profile tables (a power key) never passes
        if reason:
            raise ApiError(422, "not_supported", "הפעולה אינה ברשימת המקשים המאושרים.", details={"action": action_id, "reason": reason})
    if spec.get("expect_from") and spec["expect_from"] in data:
        # the state Home Assistant reports after success is the value we asked for (a mode, an option, a number)
        v = data[spec["expect_from"]]
        spec = {**spec, "expect": (str(int(v)) if isinstance(v, float) and v.is_integer() else str(v))}
    if ea:
        # stored as a readable "attribute=value" (never compared to the state); expectation_for() drops it when the
        # entity does not report that attribute at all, and the action is then honestly "sent", not "confirmed"
        arg = ea["argument"]
        shown = "ungrouped" if arg is None else (",".join(sorted(data[arg])) if isinstance(data.get(arg), list) else _fmt(data[arg]))
        spec = {**spec, "expect": f"{ea['attribute']}={shown}"}
    return spec, data


def check_entity_range(action_id: str, data: dict[str, Any], attributes: dict[str, Any] | None) -> None:
    """A climate target must lie in the entity's own min_temp..max_temp (TEMPERATURE_DEFAULT_RANGE where it reports
    none): a heat pump that targets 36 is not an air conditioner limited to 35, and a 25-degree request to a unit
    whose range ends at 30 stays fine. Raises 422 like validate_action."""
    if action_id != "climate.set_temperature" or "temperature" not in data:
        return
    attrs = attributes or {}

    def num(key: str, fallback: float) -> float:
        v = attrs.get(key)
        return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) and v == v else fallback

    lo, hi = num("min_temp", TEMPERATURE_DEFAULT_RANGE[0]), num("max_temp", TEMPERATURE_DEFAULT_RANGE[1])
    if lo <= hi and not lo <= float(data["temperature"]) <= hi:
        raise ApiError(422, "validation", f"temperature מחוץ לטווח {_fmt(lo)}–{_fmt(hi)}.", details={"min": lo, "max": hi})


def _fmt(v: Any) -> str:
    if isinstance(v, bool):
        return "true" if v else "false"
    return str(int(v)) if isinstance(v, float) and v.is_integer() else str(v)


def expectation_for(spec: dict[str, Any], attributes: dict[str, Any] | None) -> str | None:
    """The expected_state to record for this request: an attribute expectation only when the entity reports that
    attribute now (a climate in heat_cool mode has no single `temperature`; a player may not report mute) - otherwise
    None, which the poll reports as "sent" (confirmation "none"), never as a confirmed fact."""
    ea = spec.get("expect_attr")
    if ea and (attributes or {}).get(ea["attribute"]) is None and not spec.get("always_expect"):
        return None
    return spec.get("expect")


def confirmation_kind(action_id: str, expected_state: str | None) -> str:
    """How an action record is confirmed: "state" (the entity's state reached the expected one), "attribute" (the
    attribute that reports the effect reached the argument, within its tolerance) or "none" (nothing observable -
    the UI says "sent", never "confirmed")."""
    if not expected_state:
        return "none"
    return "attribute" if (ACTIONS.get(action_id) or {}).get("expect_attr") else "state"


def attribute_reached(action_id: str, arguments: dict[str, Any], state: str | None, attributes: dict[str, Any] | None) -> bool:
    """Whether the entity's reported attribute matches what the action asked for (confirmation_kind "attribute")."""
    ea = (ACTIONS.get(action_id) or {}).get("expect_attr")
    if not ea:
        return False
    attrs = attributes or {}
    target = (arguments or {}).get(ea["argument"]) if ea["argument"] else None
    actual = attrs.get(ea["attribute"])
    if ea["tolerance"] == "ungrouped":  # CR-016: any of the four "ungrouped" encodings - [] (MA), [self] (Sonos, WiiM), null (HEOS), absent
        return actual is None or (isinstance(actual, list) and len(actual) <= 1)
    if ea["tolerance"] == "superset":  # a join: every requested member is listed now (the leader lists itself too)
        return isinstance(target, list) and isinstance(actual, list) and set(target) <= set(actual)
    if isinstance(target, str):
        return isinstance(actual, str) and actual == target.strip()
    if isinstance(target, bool) or ea["tolerance"] is None:
        return actual is target if isinstance(target, bool) else actual == target
    try:
        want = float(target)
    except (TypeError, ValueError):
        return False
    if actual is None:
        # a fan set to 0 % turns off, a cover at 0 closes; some integrations then drop the attribute
        return want == 0 and state in ("off", "closed")
    try:
        got = float(actual)
    except (TypeError, ValueError):
        return False
    tol = ea["tolerance"]
    if isinstance(tol, str):
        # the device's own step: Home Assistant maps a requested percentage UP to the next speed step (a 3-speed fan
        # asked for 50 runs at speed 2 = 66/67, never at 33), so the confirmation expects exactly that step - within
        # 1 point for HA's own rounding of 66.67 - and a fan that stayed on 33 is never taken for confirmed
        try:
            step = float(attrs.get(tol) or 0.0)
        except (TypeError, ValueError):
            step = 0.0
        if step > 1.0 and want > 0:
            want = min(100.0, math.ceil(want / step - 1e-6) * step)
        tol = 1.0
    return abs(got - want) <= float(tol) + 1e-9
