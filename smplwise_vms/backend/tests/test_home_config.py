"""CR-015 (media screens): the home screen's `media` widget in `services/home_config.py` - a widget like the others (on / sizes /
heading / phone settings / order / personal override) that has no entity of its own. Pure functions, no database; the
integration with the settings route is covered by tests/test_home_screen.py."""
from __future__ import annotations

import pytest

from smplwise.services import home_config


def test_media_is_a_known_widget_appended_last_with_the_common_defaults():
    assert home_config.WIDGET_IDS[5] == "media" and home_config.WIDGET_IDS[-8:] == ("agenda", "launcher", "elevators", "temperature", "generators", "doors", "notices", "presence")  # BV1 appended two after it
    cfg = home_config.default_config()
    assert cfg["order"] == ["clock", "weather", "shabbat", "alarm", "quick", "media", "agenda", "launcher", "elevators", "temperature", "generators", "doors", "notices", "presence"]
    assert cfg["media"] == {"on": True, "sizes": {"a": "m", "b": "s", "c": "m"}, "label": "", "phone_on": None, "phone_size": None}


def test_a_config_saved_before_the_widget_existed_gains_it_last_and_keeps_its_order():
    old = {"order": ["quick", "clock", "weather", "shabbat", "alarm"], "clock": {"on": False}}
    cfg = home_config.normalise(old)
    assert cfg["order"] == ["quick", "clock", "weather", "shabbat", "alarm", "media", "agenda", "launcher", "elevators", "temperature", "generators", "doors", "notices", "presence"]
    assert cfg["clock"]["on"] is False and cfg["media"]["on"] is True


def test_media_accepts_the_common_keys_and_nothing_else():
    cfg = home_config.normalise({"media": {"on": False, "sizes": {"b": "m"}, "label": " מסכים בבית ", "phone_on": True, "phone_size": "s"}})
    assert cfg["media"] == {"on": False, "sizes": {"a": "m", "b": "m", "c": "m"}, "label": "מסכים בבית", "phone_on": True, "phone_size": "s"}
    for bad in ({"entity": "media_player.tv"}, {"actions": ["lights_off"]}, {"sizes": {"a": "xl"}}, {"on": "yes"}, {"label": "x" * 31}, {"phone_size": "huge"}):
        with pytest.raises(ValueError):
            home_config.normalise({"media": bad})


def test_order_may_move_media_and_an_unknown_widget_is_still_refused():
    cfg = home_config.normalise({"order": ["media", "clock"]})
    assert cfg["order"] == ["media", "clock", "weather", "shabbat", "alarm", "quick", "agenda", "launcher", "elevators", "temperature", "generators", "doors", "notices", "presence"]
    with pytest.raises(ValueError):
        home_config.normalise({"order": ["media", "tv"]})


def test_the_personal_override_can_switch_and_size_the_media_widget_for_the_direction_shown():
    personal = home_config.normalise_personal({"direction": "b", "order": ["media"], "widgets": {"media": {"on": False, "size": "l"}}})
    assert personal["order"][0] == "media" and personal["widgets"]["media"] == {"on": False, "size": "l"}
    out, direction = home_config.apply_personal(home_config.default_config(), "a", personal)
    assert direction == "b" and out["order"][0] == "media"
    assert out["media"]["on"] is False and out["media"]["sizes"]["b"] == "l" and out["media"]["sizes"]["a"] == "m"
    with pytest.raises(ValueError):
        home_config.normalise_personal({"widgets": {"media": {"label": "x"}}})


def test_suggestions_and_the_legacy_keys_leave_the_media_widget_untouched():
    cfg = home_config.with_suggestions(home_config.default_config(), ["weather.home"], [])
    assert cfg["media"] == home_config.default_config()["media"]
    legacy = home_config.from_legacy(lambda k, d: {"home.clock": "time"}.get(k, d))
    assert legacy is not None and legacy["media"]["on"] is True and legacy["order"][5] == "media" and legacy["order"][-8:] == ["agenda", "launcher", "elevators", "temperature", "generators", "doors", "notices", "presence"]


# ---------------------------------------------------------------- CR-INFRA-ELEVATORS 2.8.0: the elevators widget (owner decision 10b + feedback 2026-10-18)

def test_elevators_widget_defaults_and_validation():
    cfg = home_config.default_config()
    assert cfg["order"][-6:] == ["elevators", "temperature", "generators", "doors", "notices", "presence"]
    assert cfg["elevators"] == {"on": True, "sizes": {"a": "m", "b": "s", "c": "m"}, "label": "", "phone_on": None, "phone_size": None, "mode": "combined", "hidden": [], "filter": "all"}
    ok = home_config.normalise({"elevators": {"mode": "both", "hidden": ["e1", "e1", "e-2"], "filter": "alerts", "sizes": {"a": "l"}}})["elevators"]
    assert (ok["mode"], ok["hidden"], ok["filter"], ok["sizes"]["a"]) == ("both", ["e1", "e-2"], "alerts", "l")
    for bad in ({"mode": "tiles"}, {"filter": "faults"}, {"hidden": "e1"}, {"hidden": ["bad id!"]}, {"hidden": [f"e{i}" for i in range(51)]}, {"entity": "x"}, {"pin": "e1"}):
        with pytest.raises(ValueError):
            home_config.normalise({"elevators": bad})
    # the elevator keys belong to the elevators widget only
    with pytest.raises(ValueError):
        home_config.normalise({"media": {"mode": "both"}})


def test_elevators_personal_override_mode_and_hidden():
    with pytest.raises(ValueError):
        home_config.normalise_personal({"widgets": {"clock": {"mode": "cards"}}})
    with pytest.raises(ValueError):
        home_config.normalise_personal({"widgets": {"elevators": {"mode": "x"}}})
    p = home_config.normalise_personal({"widgets": {"elevators": {"mode": "cards", "hidden": ["e2"], "size": "l"}}})
    assert p["widgets"] == {"elevators": {"mode": "cards", "hidden": ["e2"], "size": "l"}}
    cfg = home_config.normalise({"elevators": {"mode": "combined", "hidden": ["e1"]}})
    out, d = home_config.apply_personal(cfg, "a", p)
    # review L5: the user's own list ADDS to the installation's
    assert (out["elevators"]["mode"], out["elevators"]["hidden"], out["elevators"]["sizes"]["a"]) == ("cards", ["e1", "e2"], "l")
    assert cfg["elevators"]["hidden"] == ["e1"]  # the installation config is untouched