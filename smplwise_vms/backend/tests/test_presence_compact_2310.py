"""PRESENCE-COMPACT-2310: the compact home card's four display options (owner answers 31.10) and the room's floor in the snapshot. Synthetic fixtures only."""
from __future__ import annotations

import json

from smplwise.db import set_setting
from smplwise.services import building_presence as bp
from test_building_presence_2271 import API, NOW, iso, put_sensor, tag
from test_presence_history_2280 import cfg_put, off_world  # noqa: F401 - the shared fixture

CARD = {"card_style": "strip", "card_empty_rooms": "hide", "card_details": "hover", "card_all_empty": "last"}


def test_card_defaults_follow_the_owner_answers(off_world):  # noqa: F811
    c, db = off_world
    cfg = c.get(f"{API}/presence/building").json()["settings"]
    assert {k: cfg[k] for k in CARD} == CARD
    with db.connection(mode="read") as conn:
        assert {k: bp.get_config(conn)[k] for k in CARD} == CARD


def test_every_option_of_the_mockup_is_accepted_and_nothing_else(off_world):  # noqa: F811
    c, _ = off_world
    for style in ("strip", "floors", "quiet", "off"):
        assert cfg_put(c, card_style=style).json()["settings"]["card_style"] == style
    assert cfg_put(c, card_empty_rooms="show").json()["settings"]["card_empty_rooms"] == "show"
    assert cfg_put(c, card_details="inline").json()["settings"]["card_details"] == "inline"
    assert cfg_put(c, card_all_empty="count").json()["settings"]["card_all_empty"] == "count"
    for key in CARD:
        assert cfg_put(c, **{key: "bogus"}).status_code == 422
    assert cfg_put(c, card_style=True).status_code == 422
    out = c.get(f"{API}/presence/building").json()["settings"]
    assert (out["card_style"], out["card_empty_rooms"], out["card_details"], out["card_all_empty"]) == ("off", "show", "inline", "count")


def test_a_corrupt_stored_value_reads_as_the_default(off_world):  # noqa: F811
    _, db = off_world
    with db.connection() as conn:
        set_setting(conn, bp.SETTINGS_KEY, json.dumps({"card_style": "neon", "card_details": 3, "card_all_empty": "count"}))
        cfg = bp.get_config(conn)
    assert cfg["card_style"] == "strip" and cfg["card_details"] == "hover" and cfg["card_all_empty"] == "count"


def test_a_room_carries_its_floor_name_or_none(off_world):  # noqa: F811
    c, db = off_world
    put_sensor(db, "binary_sensor.shelly_presence_lobby", "on", iso(1))
    put_sensor(db, "binary_sensor.other", "off", iso(30), area=("a_hall", "מסדרון"))
    assert tag(c, "binary_sensor.shelly_presence_lobby", "binary_sensor.other").status_code == 200
    cfg_put(c, enabled=True)
    with db.connection() as conn:
        conn.execute("INSERT OR REPLACE INTO ha_floors(floor_id, name, level, icon, position, updated_at) VALUES ('f2', 'קומה 2', 2, NULL, 0, ?)", (iso(0),))
        conn.execute("INSERT OR REPLACE INTO ha_areas(area_id, name, floor_id, icon, position, updated_at) VALUES ('a_hall', 'מסדרון', 'f2', NULL, 0, ?)", (iso(0),))
    with db.connection(mode="read") as conn:
        rooms = {r["area_id"]: r for r in bp.snapshot(conn, NOW)["rooms"]}
    assert rooms["a_hall"]["floor"] == "קומה 2"
    assert all(r["floor"] is None for k, r in rooms.items() if k != "a_hall")
