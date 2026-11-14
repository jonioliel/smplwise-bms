"""PRESENCE-COUNT-2400: the home card's new default style "count" (owner round 18, Q26) and the rule that an installation which SAVED a style
keeps it. Synthetic fixtures only."""
from __future__ import annotations

import json

from smplwise.db import get_setting, set_setting
from smplwise.services import building_presence as bp
from test_building_presence_2271 import API
from test_presence_history_2280 import cfg_put, off_world  # noqa: F401 - the shared fixture


def _store(db, doc: dict) -> None:
    with db.connection() as conn:
        set_setting(conn, bp.SETTINGS_KEY, json.dumps(doc))


def _raw(db) -> dict:
    with db.connection(mode="read") as conn:
        return json.loads(get_setting(conn, bp.SETTINGS_KEY, "") or "{}")


def _style(c) -> str:
    return c.get(f"{API}/presence/building").json()["settings"]["card_style"]


def test_count_is_the_first_choice_and_the_default(off_world):  # noqa: F811
    c, _ = off_world
    assert bp.CHOICES["card_style"][0] == "count" == bp.DEFAULTS["card_style"]
    assert set(bp.CHOICES["card_style"]) == {"count", "strip", "floors", "quiet", "off"}
    assert _style(c) == "count"


def test_a_save_without_a_style_does_not_pin_the_default(off_world):  # noqa: F811
    c, db = off_world
    assert cfg_put(c, hold_seconds=90).json()["settings"]["card_style"] == "count"
    raw = _raw(db)
    assert "card_style" not in raw and bp.STYLE_CHOSEN not in raw, "an unchosen style is not stored; the default follows the release"
    assert raw["hold_seconds"] == 90


def test_an_explicit_choice_is_kept_across_later_saves(off_world):  # noqa: F811
    c, db = off_world
    for style in ("strip", "count", "quiet"):
        assert cfg_put(c, card_style=style).json()["settings"]["card_style"] == style
        assert cfg_put(c, empty_minutes=15).json()["settings"]["card_style"] == style
        raw = _raw(db)
        assert raw["card_style"] == style and raw[bp.STYLE_CHOSEN] is True


def test_the_marker_never_reaches_the_api(off_world):  # noqa: F811
    c, _ = off_world
    out = cfg_put(c, card_style="strip").json()["settings"]
    assert bp.STYLE_CHOSEN not in out
    assert bp.STYLE_CHOSEN not in c.get(f"{API}/presence/building").json()["settings"]
    assert cfg_put(c, **{bp.STYLE_CHOSEN: True}).status_code == 422, "the marker is not a settable field"


def test_a_pre_2400_store_with_the_old_default_moves_to_count(off_world):  # noqa: F811
    c, db = off_world
    # 2.31.0 - 2.39.x wrote the whole set on every save: "strip" there is the old default, not a recorded choice
    _store(db, {"enabled": True, "hold_seconds": 45, "card_style": "strip", "card_empty_rooms": "show", "card_details": "inline", "card_all_empty": "count"})
    cfg = c.get(f"{API}/presence/building").json()["settings"]
    assert cfg["card_style"] == "count"
    assert (cfg["card_empty_rooms"], cfg["card_details"], cfg["card_all_empty"], cfg["hold_seconds"]) == ("show", "inline", "count", 45), "the other options stay"
    cfg_put(c, map_tint=False)
    assert "card_style" not in _raw(db) and _style(c) == "count"


def test_a_pre_2400_store_with_another_style_keeps_it(off_world):  # noqa: F811
    c, db = off_world
    for style in ("floors", "quiet", "off"):
        _store(db, {"enabled": True, "card_style": style})
        assert _style(c) == style, "a non-default stored style was an administrator's choice"
        cfg_put(c, hold_seconds=30)
        raw = _raw(db)
        assert raw["card_style"] == style and raw[bp.STYLE_CHOSEN] is True, "the next save records the choice"


def test_a_marked_strip_is_kept_and_a_corrupt_marker_is_ignored(off_world):  # noqa: F811
    c, db = off_world
    _store(db, {"card_style": "strip", bp.STYLE_CHOSEN: True})
    assert _style(c) == "strip"
    _store(db, {"card_style": "strip", bp.STYLE_CHOSEN: "yes"})
    assert _style(c) == "count", "only a real true marks a choice"
    _store(db, {"card_style": "neon", bp.STYLE_CHOSEN: True})
    assert _style(c) == "count", "an unknown style is never kept, marker or not"


def test_a_refused_style_changes_nothing(off_world):  # noqa: F811
    c, db = off_world
    cfg_put(c, card_style="floors")
    assert cfg_put(c, card_style="bogus").status_code == 422
    assert _style(c) == "floors" and _raw(db)["card_style"] == "floors"
