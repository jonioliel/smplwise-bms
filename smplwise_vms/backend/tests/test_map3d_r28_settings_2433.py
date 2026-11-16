"""PLAN3D-R28-UI-2433 (round 28, the 3D map): the open questions of the round as settings, each at the recommended answer until
the owner answers - the room pills, the room card and the spread levels. Each key validates its choices and needs system.configure."""
from __future__ import annotations

from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.main import create_app

DEFAULTS = {
    "map.room_pills": "room",
    "map.room_pill_tap": "popover",
    "map.room_pill_quiet": "name",
    "map.room_card_place": "side",
    "map.room_card_confirm": "system",
    "map.room_card_camera": "snapshot",
    "map.stack_backdrop": "theme",
    "map.stack_pick": "two_tap",
}
OTHER = {
    "map.room_pills": ["room_always", "device"],
    "map.room_pill_tap": ["card"],
    "map.room_pill_quiet": ["hide", "bubble"],
    "map.room_card_place": ["float", "sheet_tablet"],
    "map.room_card_confirm": ["bulk"],
    "map.room_card_camera": ["live", "none"],
    "map.stack_backdrop": ["dark"],
    "map.stack_pick": ["one_tap"],
}


def test_round28_map_settings_default_to_the_recommended_answers(settings):
    c = TestClient(create_app(settings))
    s = c.get("/api/v1/settings").json()["settings"]
    for key, value in DEFAULTS.items():
        assert s[key] == value, key


def test_round28_map_settings_accept_their_choices_only(settings):
    c = TestClient(create_app(settings))
    for key, values in OTHER.items():
        for v in values:
            r = c.patch("/api/v1/settings", json={key: v})
            assert r.status_code == 200 and r.json()["settings"][key] == v, (key, v)
        assert c.patch("/api/v1/settings", json={key: "nonsense"}).status_code == 422, key
    # a confirmation can never be switched off: "none" is not a choice (doors, gates and the alarm always ask)
    assert c.patch("/api/v1/settings", json={"map.room_card_confirm": "none"}).status_code == 422


def test_round28_map_settings_need_configure(settings):
    c = TestClient(create_app(settings))
    bind(c, settings, "dana", "viewer", "installation", "*")
    assert c.patch("/api/v1/settings", json={"map.room_pills": "device"}, headers=as_user("dana")).status_code == 403
