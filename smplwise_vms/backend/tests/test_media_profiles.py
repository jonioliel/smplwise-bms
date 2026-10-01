"""CR-015: the brand profiles (services/media_profiles.py) and the `route: "media"` actions of the allow-list (services/ha_bridge.py).

The rules proved here: the key vocabulary equals the client's (frontend/src/api/media-screens.ts KEY_IDS); a POWER key exists in no
table and no caller can name one; a key outside a profile is refused; the generic profile has no keys; detection from the vendor
platform; every media action is `route: "media"` and is never offered by the generic catalogue; the static refusals of
`validate_action` (power key, free-form play_media, list smuggling, a bare remote.turn_on)."""
from __future__ import annotations

import re
from pathlib import Path

import pytest

from smplwise.errors import ApiError
from smplwise.services import ha_bridge, media_profiles as mp

ROOT = Path(__file__).resolve().parents[3]

POWER_WORDS = ("POWER", "POWEROFF", "STANDBY", "SLEEP", "WAKEUP", "SUSPEND")


def client_key_ids() -> list[str]:
    src = (ROOT / "frontend" / "src" / "api" / "media-screens.ts").read_text(encoding="utf-8")
    block = re.search(r"export const KEY_IDS = \[(.*?)\] as const;", src, re.S).group(1)
    return re.findall(r"'([a-z0-9]+)'", block)


def test_the_vocabulary_equals_the_client():
    assert list(mp.KEY_IDS) == client_key_ids()


def test_every_profile_code_belongs_to_the_vocabulary_and_none_is_a_power_key():
    for profile, table in mp.CODES.items():
        assert set(table) <= set(mp.KEY_IDS), profile
        for key, code in table.items():
            assert not any(w in code.upper() for w in POWER_WORDS), (profile, key, code)
    for profile, table in mp.MODEL_CODES.items():
        assert set(table) <= set(mp.KEY_IDS)
        assert not any(w in code.upper() for code in table.values() for w in POWER_WORDS)
    for key in mp.KEY_IDS:
        assert not any(w in key.upper() for w in POWER_WORDS), "a power key is not even in our vocabulary"


def test_generic_has_no_keys_and_the_others_have_the_transport_their_brand_needs():
    assert mp.keys_of("generic") == [] and mp.TRANSPORT["generic"] is None and not mp.has_text("generic")
    assert mp.TRANSPORT["samsung_smart"] == ("media_player.play_media", "media_content_id", "vendor")
    assert mp.TRANSPORT["lg_webos"] == ("webostv.button", "button", "vendor")
    assert mp.TRANSPORT["android_tv"] == ("remote.send_command", "command", "remote")
    assert mp.has_text("samsung_smart") and mp.has_text("android_tv") and not mp.has_text("lg_webos")  # LG text entry is UNVERIFIED -> off


def test_unverified_keys_stay_off_until_a_screen_enables_them():
    assert "blue" not in mp.keys_of("samsung_smart") and mp.model_key_options("samsung_smart") == ["blue"]
    assert mp.code_of("samsung_smart", "blue") is None
    assert mp.code_of("samsung_smart", "blue", ["blue"]) == "KEY_CYAN"
    assert "rew" not in mp.keys_of("lg_webos") and "ff" not in mp.keys_of("lg_webos")
    assert mp.model_key_options("lg_webos") == [] and mp.model_key_options("android_tv") == []


def test_detection_from_the_vendor_platform():
    assert mp.detect({"samsungtv_smart", "cast"}) == "samsung_smart"
    assert mp.detect({"webostv"}) == "lg_webos"
    assert mp.detect({"androidtv_remote", "cast"}) == "android_tv"
    assert mp.detect({"samsungtv", "cast"}) == "generic" and mp.detect({"androidtv"}) == "generic" and mp.detect(set()) == "generic"


def test_the_catalogue_carries_vocabularies_only():
    body = mp.catalogue()
    assert body["version"] == mp.PROFILES_VERSION == 1
    assert [p["id"] for p in body["profiles"]] == ["samsung_smart", "lg_webos", "android_tv", "generic"]
    lg = next(p for p in body["profiles"] if p["id"] == "lg_webos")
    assert lg["apps"] == "source_list" and lg["text"] is False and {"info", "guide", "exit"} <= set(lg["extras"])
    text = str(body)
    assert "KEY_" not in text and "webostv" not in text and "DPAD" not in text, "no service names and no codes"


@pytest.mark.parametrize("action,data", [
    ("media_player.play_media", {"media_content_type": "send_key", "media_content_id": "KEY_POWER"}),
    ("media_player.play_media", {"media_content_type": "send_key", "media_content_id": "KEY_POWEROFF"}),
    ("media_player.play_media", {"media_content_type": "send_key", "media_content_id": "KEY_UP+KEY_POWER"}),
    ("media_player.play_media", {"media_content_type": "send_key", "media_content_id": "key_up"}),
    ("media_player.play_media", {"media_content_type": "send_key", "media_content_id": "KEY_UNKNOWN"}),
    ("remote.send_command", {"command": "POWER"}),
    ("remote.send_command", {"command": "SLEEP"}),
    ("webostv.button", {"button": "POWER"}),
    ("webostv.button", {"button": "NETFLIX"}),
])
def test_a_power_key_or_a_code_outside_the_tables_is_refused_by_validate_action(action, data):
    entity = {"media_player.play_media": "media_player.tv", "remote.send_command": "remote.tv", "webostv.button": "media_player.tv"}[action]
    with pytest.raises(ApiError) as exc:
        ha_bridge.validate_action(action, entity, data)
    assert exc.value.code in ("not_supported", "validation"), exc.value.code


def test_free_form_play_media_and_list_smuggling_are_refused():
    for ctype in ("url", "app", "channel", "music", "video", "SEND_KEY"):
        with pytest.raises(ApiError):
            ha_bridge.validate_action("media_player.play_media", "media_player.tv", {"media_content_type": ctype, "media_content_id": "KEY_UP"})
    with pytest.raises(ApiError):
        ha_bridge.validate_action("remote.send_command", "remote.tv", {"command": ["POWER", "DPAD_UP"]})
    with pytest.raises(ApiError):
        ha_bridge.validate_action("remote.turn_on", "remote.tv", {})  # a bare remote.turn_on is a power-on: only with an activity
    with pytest.raises(ApiError):
        ha_bridge.validate_action("remote.send_command", "remote.tv", {"command": "DPAD_UP", "num_repeats": 50})  # no extra argument exists


def test_the_good_calls_pass_and_carry_exactly_their_arguments():
    spec, data = ha_bridge.validate_action("media_player.play_media", "media_player.tv", {"media_content_type": "send_key", "media_content_id": "KEY_UP"})
    assert data == {"entity_id": "media_player.tv", "media_content_type": "send_key", "media_content_id": "KEY_UP"} and spec["route"] == "media"
    assert ha_bridge.validate_action("webostv.button", "media_player.tv", {"button": "UP"})[1] == {"entity_id": "media_player.tv", "button": "UP"}
    assert ha_bridge.validate_action("remote.send_command", "remote.tv", {"command": "text:שלום"})[1]["command"] == "text:שלום"
    assert ha_bridge.validate_action("remote.turn_on", "remote.tv", {"activity": "netflix://"})[0]["expect"] == "current_activity=netflix://"
    assert ha_bridge.validate_action("media_player.select_source", "media_player.tv", {"source": "HDMI1"})[0]["expect"] == "source=HDMI1"
    # webostv.* targets a media_player, never a remote
    with pytest.raises(ApiError) as exc:
        ha_bridge.validate_action("webostv.button", "remote.tv", {"button": "UP"})
    assert exc.value.code == "action_domain_mismatch"


def test_every_media_action_is_route_media_and_never_offered_generically():
    new = {"media_player.volume_up", "media_player.volume_down", "media_player.media_play_pause", "media_player.media_next_track", "media_player.media_previous_track",
           "media_player.select_source", "media_player.play_media", "remote.send_command", "remote.turn_on", "webostv.button", "webostv.select_sound_output",
           # CR-016 (bridge 0.5.0): the player controls and the grouping actions
           "media_player.media_seek", "media_player.shuffle_set", "media_player.repeat_set", "media_player.select_sound_mode", "media_player.join", "media_player.unjoin",
           "music_assistant.play_media", "music_assistant.transfer_queue"}
    assert {a for a, spec in ha_bridge.ACTIONS.items() if spec.get("route") == "media"} == new
    offered = {a["id"] for domain in ("media_player", "remote", "webostv") for a in ha_bridge.actions_for(domain)}
    assert not offered & new
    # the pre-existing media_player actions are unchanged and still offered
    assert {"media_player.turn_on", "media_player.turn_off", "media_player.volume_set", "media_player.volume_mute", "media_player.media_play", "media_player.media_pause"} <= offered
    # never a turn_off / toggle of a remote and never webostv.command
    assert "remote.turn_off" not in ha_bridge.ACTIONS and "webostv.command" not in ha_bridge.ACTIONS and "remote.toggle" not in ha_bridge.ACTIONS


def test_text_problems():
    assert mp.text_problem("שלום") is None and mp.text_problem("x" * 200) is None
    assert mp.text_problem("") == "length" and mp.text_problem("x" * 201) == "length" and mp.text_problem(5) == "length"
    assert mp.text_problem("a\nb") == "control_characters" and mp.text_problem("a\x00b") == "control_characters"
