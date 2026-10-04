"""CR-015 bridge 0.4.0: `media_policy.py` - what `smplwise_bridge.execute` accepts for the media services, decided without trusting the add-on. The
module is loaded by path (no Home Assistant). Power keys at any position, source / activity membership, typed text, the argument sets, the
services that never exist, and the drift test: the bridge's services and key tables equal the add-on's (`route: "media"` actions of
services/ha_bridge.py, services/media_profiles.py)."""
from __future__ import annotations

import json
from typing import Any

import pytest
from bridge_loader import MIRROR, SRC, init_allowed_services, load

from smplwise.services import ha_bridge, media_profiles as mp

policy = load("media_policy")
const = load("const")

ATTRS: dict[str, dict[str, Any]] = {
    "media_player.tv": {"source_list": ["TV", "HDMI1", "Netflix"], "sound_output": "tv_speaker"},
    "remote.tv": {"activity_list": ["netflix://", "https://www.youtube.com"], "current_activity": "netflix://"},
}


def attrs(entity_id: str) -> dict[str, Any] | None:
    return ATTRS.get(entity_id)


def check(domain: str, service: str, data: Any) -> str | None:
    return policy.refusal(domain, service, data, attrs)


# ------------------------------------------------------------------------------------------------ drift


def test_the_key_tables_equal_the_add_ons_and_hold_no_power_key():
    assert policy.SAMSUNG_KEYS == mp.ALL_SAMSUNG and policy.LG_BUTTONS == mp.ALL_LG and policy.ANDROID_KEYS == mp.ALL_ANDROID
    for table in (policy.SAMSUNG_KEYS, policy.LG_BUTTONS, policy.ANDROID_KEYS):
        assert not [k for k in table if any(w in k.upper() for w in ("POWER", "STANDBY", "SLEEP", "WAKE"))]


def test_the_bridges_media_services_are_exactly_the_add_ons_route_media_actions():
    add_on = {(spec["domain"], spec["service"]) for spec in ha_bridge.ACTIONS.values() if spec.get("route") == "media"}
    assert policy.MEDIA_SERVICES == add_on
    allowed = init_allowed_services()
    assert policy.MEDIA_SERVICES <= allowed
    assert not (policy.NEVER_SERVICES & allowed), "remote.turn_off, webostv.command and the like are not in the allow-list at all"
    every = {(a["domain"], a["service"]) for a in ha_bridge.ACTIONS.values()}
    assert every <= allowed, "the add-on never asks for a service the bridge would not accept"


def test_the_argument_sets_equal_the_add_ons_schemas():
    for action_id, spec in ha_bridge.ACTIONS.items():
        if spec.get("route") != "media":
            continue
        assert policy.ALLOWED_ARGS[(spec["domain"], spec["service"])] == frozenset(spec["args"]), action_id
        assert policy.TARGET_DOMAIN[spec["domain"]] == spec.get("entity_domain", spec["domain"])


def test_what_the_add_on_builds_the_bridge_accepts():
    """Every call the commands route can build (one per profile code and per media action) passes the independent policy."""
    built: list[tuple[str, str, dict[str, Any]]] = []
    for profile in ("samsung_smart", "lg_webos", "android_tv"):
        action_id, arg, _role = mp.TRANSPORT[profile]
        entity = "remote.tv" if profile == "android_tv" else "media_player.tv"
        for key, code in {**mp.CODES[profile], **mp.MODEL_CODES[profile]}.items():
            args = {"media_content_type": "send_key", "media_content_id": code} if action_id == "media_player.play_media" else {arg: code}
            spec, data = ha_bridge.validate_action(action_id, entity, args)
            built.append((spec["domain"], spec["service"], data))
    for action_id, entity, args in (("media_player.volume_up", "media_player.tv", {}), ("media_player.volume_down", "media_player.tv", {}), ("media_player.media_play_pause", "media_player.tv", {}),
                                    ("media_player.media_next_track", "media_player.tv", {}), ("media_player.media_previous_track", "media_player.tv", {}),
                                    ("media_player.select_source", "media_player.tv", {"source": "HDMI1"}), ("remote.turn_on", "remote.tv", {"activity": "netflix://"}),
                                    ("webostv.select_sound_output", "media_player.tv", {"sound_output": "tv_speaker"}),
                                    ("media_player.play_media", "media_player.tv", {"media_content_type": "send_text", "media_content_id": "שלום"}),
                                    ("remote.send_command", "remote.tv", {"command": "text:hello"})):
        spec, data = ha_bridge.validate_action(action_id, entity, args)
        built.append((spec["domain"], spec["service"], data))
    assert len(built) > 100
    for domain, service, data in built:
        assert check(domain, service, data) is None, (domain, service, data)


def test_version_and_mirror_are_consistent():
    manifest = json.loads((SRC / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["version"] == const.VERSION == "0.6.2"
    assert (SRC / "media_policy.py").read_bytes() == (MIRROR / "media_policy.py").read_bytes()
    import sys

    from bridge_loader import REPO

    sys.path.insert(0, str(REPO / "scripts"))
    import sync_integration

    assert sync_integration.differences() == [], "run python scripts/sync_integration.py"


def test_execute_calls_the_policy_before_the_service():
    src = (SRC / "__init__.py").read_text(encoding="utf-8")
    assert "media_policy.is_media(domain, service)" in src and "media_policy.refusal(domain, service, data, _attributes, _platform)" in src
    assert src.index("media_policy.refusal(") < src.index("hass.services.async_call(domain, service, data, blocking=True, context=context)")
    assert "from . import media_policy" in src


# ------------------------------------------------------------------------------------------------ power keys at every position


POWER_SPELLINGS = ["KEY_POWER", "KEY_POWEROFF", "KEY_POWERON", "POWER", "POWEROFF", "power", "Power", "KEY_STANDBY", "KEY_SLEEP", "KEY_WAKEUP", "KEY_UP+KEY_POWER", "KEY_POWER+KEY_UP", " KEY_POWER",
                   "KEY_POWER ", "KEY_POWER\n", "KEY_UP,KEY_POWER", "KEY_UP;KEY_POWER", "KEY_UP KEY_POWER", "KEY_​POWER", "key_power", "KEY_POWER+500+KEY_UP"]


@pytest.mark.parametrize("code", POWER_SPELLINGS)
def test_no_power_key_passes_in_any_transport(code):
    assert check("media_player", "play_media", {"entity_id": "media_player.tv", "media_content_type": "send_key", "media_content_id": code}) == "media_key_refused"
    assert check("remote", "send_command", {"entity_id": "remote.tv", "command": code}) == "media_key_refused"
    assert check("webostv", "button", {"entity_id": "media_player.tv", "button": code}) == "media_key_refused"


def test_a_command_list_or_other_type_cannot_smuggle_a_key():
    base = {"entity_id": "remote.tv"}
    for command in (["DPAD_UP", "POWER"], ["POWER"], ("DPAD_UP",), {"a": 1}, 5, None, True):
        assert check("remote", "send_command", {**base, "command": command}) == "media_key_refused", command
    for button in (["UP"], 5, None, {"x": 1}):
        assert check("webostv", "button", {"entity_id": "media_player.tv", "button": button}) == "media_key_refused", button
    for content in (["KEY_UP"], 5, None):
        assert check("media_player", "play_media", {"entity_id": "media_player.tv", "media_content_type": "send_key", "media_content_id": content}) == "media_key_refused"


def test_free_form_play_media_and_unknown_types_are_refused():
    for kind in ("url", "app", "channel", "music", "video", "playlist", "SEND_KEY", None, "", 1):
        assert check("media_player", "play_media", {"entity_id": "media_player.tv", "media_content_type": kind, "media_content_id": "KEY_UP"}) == "media_play_media_type", kind
    assert check("media_player", "play_media", {"entity_id": "media_player.tv", "media_content_type": "send_key"}) == "media_key_refused", "no content id: no key"


# ------------------------------------------------------------------------------------------------ memberships, text, arguments


def test_a_source_must_be_in_the_entitys_current_source_list():
    ok = {"entity_id": "media_player.tv", "source": "HDMI1"}
    assert check("media_player", "select_source", ok) is None
    for source in ("HDMI9", "hdmi1", " HDMI1", "", 5, None, ["HDMI1"], "x" * 121):
        assert check("media_player", "select_source", {**ok, "source": source}) == "media_source_not_listed", source
    assert check("media_player", "select_source", {"entity_id": "media_player.ghost", "source": "HDMI1"}) == "media_source_not_listed", "an entity that cannot be read"
    ATTRS["media_player.tv"]["source_list"] = "HDMI1"
    try:
        assert check("media_player", "select_source", ok) == "media_source_not_listed", "a list that is not a list"
    finally:
        ATTRS["media_player.tv"]["source_list"] = ["TV", "HDMI1", "Netflix"]


def test_an_activity_must_be_in_the_remotes_current_activity_list_and_is_required():
    assert check("remote", "turn_on", {"entity_id": "remote.tv", "activity": "netflix://"}) is None
    assert check("remote", "turn_on", {"entity_id": "remote.tv", "activity": "evil://x"}) == "media_activity_not_listed"
    assert check("remote", "turn_on", {"entity_id": "remote.tv"}) == "media_arguments", "a bare remote.turn_on is a power-on"
    assert check("remote", "turn_on", {"entity_id": "remote.tv", "activity": None}) == "media_activity_not_listed"
    assert check("remote", "turn_on", {"entity_id": "remote.tv", "activity": "netflix://", "device": "x"}) == "media_arguments"


PLATFORMS = {"remote.tv": "androidtv_remote", "remote.hub": "harmony", "remote.ir": "broadlink", "media_player.tv": "androidtv_remote"}


def check_on(domain: str, service: str, data: Any, platforms: dict[str, str] | None = PLATFORMS) -> str | None:
    return policy.refusal(domain, service, data, attrs, (lambda e: platforms.get(e)) if platforms is not None else None)


def test_remote_calls_are_bound_to_the_android_remote_platform_when_the_platform_is_known():
    ATTRS["remote.hub"] = {"activity_list": ["Watch TV", "PowerOff"], "current_activity": "Watch TV"}
    ATTRS["remote.ir"] = {"activity_list": ["netflix://"]}
    try:
        assert check_on("remote", "turn_on", {"entity_id": "remote.tv", "activity": "netflix://"}) is None
        assert check_on("remote", "send_command", {"entity_id": "remote.tv", "command": "DPAD_UP"}) is None
        assert check_on("remote", "turn_on", {"entity_id": "remote.hub", "activity": "Watch TV"}) == "media_entity", "a Harmony hub is not an Android TV remote"
        assert check_on("remote", "send_command", {"entity_id": "remote.hub", "command": "DPAD_UP"}) == "media_entity"
        assert check_on("remote", "turn_on", {"entity_id": "remote.ir", "activity": "netflix://"}) == "media_entity"
        # an entity the registry does not know (None) is judged by the rest of the policy only; no platform function: same
        assert check_on("remote", "turn_on", {"entity_id": "remote.tv", "activity": "netflix://"}, {}) is None
        assert check_on("remote", "turn_on", {"entity_id": "remote.tv", "activity": "netflix://"}, None) is None
        # a media_player is not bound by the remote rule
        assert check_on("media_player", "select_source", {"entity_id": "media_player.tv", "source": "HDMI1"}, {"media_player.tv": "samsungtv_smart"}) is None
    finally:
        ATTRS.pop("remote.hub", None), ATTRS.pop("remote.ir", None)


@pytest.mark.parametrize("word", ["PowerOff", "poweroff", "power_off", "Power Off", "power-off", "Standby", "STANDBY", "off", "Off", "turn off", "Shutdown", "Sleep", "power.off"])
def test_a_power_like_activity_or_command_is_refused_with_or_without_platform_info(word):
    ATTRS["remote.tv"]["activity_list"].append(word)  # even an activity the entity itself lists
    try:
        for platforms in (PLATFORMS, None, {}):
            assert check_on("remote", "turn_on", {"entity_id": "remote.tv", "activity": word}, platforms) == "media_activity_not_listed", (word, platforms)
            assert check_on("remote", "send_command", {"entity_id": "remote.tv", "command": word}, platforms) == "media_key_refused", (word, platforms)
    finally:
        ATTRS["remote.tv"]["activity_list"].remove(word)
    assert check_on("remote", "send_command", {"entity_id": "remote.tv", "command": "text:off"}, None) is None, "typed text is text, not a power command"
    assert check_on("remote", "turn_on", {"entity_id": "remote.tv", "activity": "netflix://"}, None) is None


def test_typed_text_is_short_and_plain():
    base = {"entity_id": "media_player.tv", "media_content_type": "send_text"}
    assert check("media_player", "play_media", {**base, "media_content_id": "שלום"}) is None and check("media_player", "play_media", {**base, "media_content_id": "x" * 200}) is None
    for text in ("", "x" * 201, "a\nb", "a\x00b", "a\x7fb", 5, None, ["a"]):
        assert check("media_player", "play_media", {**base, "media_content_id": text}) == "media_text_refused", text
    assert check("remote", "send_command", {"entity_id": "remote.tv", "command": "text:hello"}) is None
    for cmd in ("text:", "text:" + "x" * 201, "text:a\nb"):
        assert check("remote", "send_command", {"entity_id": "remote.tv", "command": cmd}) == "media_text_refused", cmd
    assert check("remote", "send_command", {"entity_id": "remote.tv", "command": "TEXT:hello"}) == "media_key_refused"


def test_no_argument_beyond_the_services_own_and_the_target_is_one_plain_entity():
    assert check("remote", "send_command", {"entity_id": "remote.tv", "command": "DPAD_UP", "num_repeats": 50}) == "media_arguments"
    assert check("remote", "send_command", {"entity_id": "remote.tv", "command": "DPAD_UP", "hold_secs": 5}) == "media_arguments"
    assert check("remote", "send_command", {"entity_id": "remote.tv", "command": "DPAD_UP", "device": "x"}) == "media_arguments"
    assert check("media_player", "volume_up", {"entity_id": "media_player.tv", "volume_level": 1}) == "media_arguments"
    assert check("media_player", "volume_up", {"entity_id": "media_player.tv", "area_id": "x"}) == "media_arguments"
    for entity in (["media_player.tv"], "media_player.tv,media_player.other", "all", "media_player.*", "media_player.TV", None, 5, "light.tv", "remote.tv"):
        assert check("media_player", "volume_up", {"entity_id": entity}) == "media_entity", entity
    assert check("webostv", "button", {"entity_id": "remote.tv", "button": "UP"}) == "media_entity", "webostv.* targets a media_player"
    assert check("remote", "send_command", {"entity_id": "media_player.tv", "command": "DPAD_UP"}) == "media_entity"
    assert check("media_player", "volume_up", "media_player.tv") == "media_arguments"
    assert check("media_player", "volume_up", {"entity_id": "media_player.tv"}) is None


def test_sound_output_shape():
    assert check("webostv", "select_sound_output", {"entity_id": "media_player.tv", "sound_output": "external_arc"}) is None
    for bad in ("", "External", "a b", "x" * 41, 5, None, ["tv_speaker"], "tv-speaker"):
        assert check("webostv", "select_sound_output", {"entity_id": "media_player.tv", "sound_output": bad}) == "media_arguments", bad


def test_the_services_that_must_never_run_are_refused_by_name_and_other_services_are_not_judged():
    for domain, service in policy.NEVER_SERVICES:
        assert check(domain, service, {"entity_id": "remote.tv"}) == "media_service_refused"
    assert ("remote", "turn_off") in policy.NEVER_SERVICES and ("webostv", "command") in policy.NEVER_SERVICES and ("remote", "toggle") in policy.NEVER_SERVICES
    assert check("light", "turn_on", {"entity_id": "light.x"}) is None and not policy.is_media("light", "turn_on")
    assert check("media_player", "turn_off", {"entity_id": "media_player.tv"}) is None and not policy.is_media("media_player", "turn_off"), "the older allow-list is untouched"
    assert policy.is_media("remote", "turn_off") and policy.is_media("media_player", "play_media")
