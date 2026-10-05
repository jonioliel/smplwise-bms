"""CR-016 (players, speakers, groups): the read side of the API on the two synthetic houses - the kinds a list returns and what filters it, the extended
fields of a speaker / receiver / group, the unplaced bucket and floors-less installations, the non-physical kinds, approval by kind, the status additions,
the administration (suggestions, dismiss, a link that carries the endpoint's cluster, ceilings, night window, placing a device in an area), the permission
`media.group`, the layout's tabs and the favourites curation, and migration 0044 on a database of the previous release. Commands: test_media_players_commands.py;
groups: test_media_groups.py; reads of the queue and the library: test_media_query.py."""
from __future__ import annotations

import json
import shutil
from typing import Any

import media_seed as mseed
import media_seed_audio as aseed
import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise import db as dbmod
from smplwise.main import create_app
from smplwise.rbac import ROLES
from smplwise.routers.access import PERMISSION_LABELS, SENSITIVE
from smplwise.services import ha_client, media_commands, media_layout, media_query

API = "/api/v1/multimedia"
SCREEN_KEYS = {"key", "name", "kind", "profile", "floor_id", "floor_name", "area_id", "area_name", "public", "live", "caps", "audio_link", "can"}
AUDIO_KEYS = SCREEN_KEYS | {"volume_max", "volume_night", "music_provider", "zones", "virtual_members"}
PRIVATE = ("media_player.", "wiim_aaaaaaaa", "uuid:", "-1884291837", "RINCON", "ha:", "library://")


@pytest.fixture()
def ma(settings, monkeypatch):
    media_query.clear()
    media_commands.BUCKETS.clear()
    app = create_app(settings)
    c = TestClient(app)
    aseed.install(c, "ma")
    aseed.approve_players(c)
    c.post(f"{API}/admin/approve", json={})  # the screens
    calls = mseed.pair(c, monkeypatch, version="0.5.0")
    keys = {n: aseed.key_with(c, e) for n, e in {"a": "media_player.wiim_a", "b": "media_player.wiim_b", "denon": "media_player.denon_main", "garden": "media_player.cast_garden",
                                                 "console": "media_player.ma_console", "tv": "media_player.cast_tv", "stereo": "media_player.ma_stereo"}.items()}
    return app, c, calls, keys, settings


@pytest.fixture()
def sonos(settings, monkeypatch):
    media_query.clear()
    media_commands.BUCKETS.clear()
    app = create_app(settings)
    c = TestClient(app)
    aseed.install(c, "sonos")
    aseed.approve_players(c)
    c.post(f"{API}/admin/approve", json={})
    calls = mseed.pair(c, monkeypatch, version="0.5.0")
    keys = {n: aseed.key_with(c, e, "speaker,player,receiver,group,session,virtual_group,service") for n, e in {"living": "media_player.sonos_living", "kitchen": "media_player.sonos_kitchen",
                                                                                                            "bedroom": "media_player.sonos_bedroom", "helper": "media_player.helper_sonos",
                                                                                                            "jf1": "media_player.jf_1", "spotify": "media_player.spotify"}.items()}
    return app, c, calls, keys, settings


def devices(c, query: str = "kind=speaker,player,receiver,group", headers=None) -> list[dict[str, Any]]:
    r = c.get(f"{API}/devices?{query}", headers=headers or {})
    assert r.status_code == 200, r.text
    return r.json()["devices"]


def by_name(items: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {d["name"]: d for d in items}


# ------------------------------------------------------------------------------------------------ lists, kinds, filters


def test_the_default_list_is_still_the_screens_and_the_player_kinds_list_the_audio_devices(ma):
    app, c, calls, keys, settings = ma
    assert [d["name"] for d in devices(c, "kind=screen")] == ["טלוויזיה חדר שינה"] and [d["name"] for d in c.get(f"{API}/devices").json()["devices"]] == ["טלוויזיה חדר שינה"]
    names = {d["name"]: d["kind"] for d in devices(c)}
    assert names == {"רמקול סלון": "speaker", "רמקול מטבח": "speaker", "מגבר קולנוע": "receiver", "רמקול גינה": "speaker", "קונסולה": "speaker", "זוג סטריאו": "group"}
    assert {d["kind"] for d in devices(c, "kind=screen,speaker")} == {"screen", "speaker"}
    assert [d["name"] for d in devices(c, "kind=receiver")] == ["מגבר קולנוע"] and [d["name"] for d in devices(c, "kind=group")] == ["זוג סטריאו"]


def test_screens_keep_their_cr015_shape_and_players_carry_the_extended_fields(ma):
    app, c, calls, keys, settings = ma
    (tv,) = devices(c, "kind=screen")
    assert set(tv) == SCREEN_KEYS and "music_provider" not in tv and set(tv["can"]) == {"control", "power", "public_ok", "bulk"}
    assert set(tv["live"]) == {"power", "play", "confirmed", "since", "now", "volume", "sound_output"}
    for d in devices(c):
        assert set(d) == AUDIO_KEYS, d["name"]
        assert set(d["live"]) == {"power", "play", "confirmed", "since", "now", "volume", "sound_output", "shuffle", "repeat", "group", "queue", "caps_known"}
        assert set(d["live"]["now"]) == {"kind", "label", "app_id", "source_id", "title", "channel", "position_s", "duration_s", "position_at", "artwork", "glyph", "hue", "artist", "album"}
        assert set(d["can"]) == {"control", "power", "public_ok", "bulk", "group", "queue", "browse"} and d["volume_max"] is None and d["volume_night"] is None, "no default ceiling (decision 7ב)"
        assert set(d["caps"]) >= {"shuffle", "repeat", "group", "volume_group", "up_next", "favourites", "stations", "playlists", "transfer"}
    blob = json.dumps(devices(c) + devices(c, "kind=screen"), ensure_ascii=False)
    assert not [p for p in PRIVATE if p in blob], "no entity id, identifier, MA uri or endpoint id in any list"


def test_music_provider_zones_and_the_now_playing_of_a_speaker(ma):
    app, c, calls, keys, settings = ma
    by = by_name(devices(c))
    a = by["רמקול סלון"]
    assert a["music_provider"] == "ma" and a["zones"] is None and a["floor_id"] == "ground" and a["area_id"] == "living"
    assert (a["live"]["power"], a["live"]["play"], a["live"]["now"]["kind"], a["live"]["now"]["title"], a["live"]["now"]["artist"], a["live"]["now"]["album"]) == ("on", "playing", "music", "שיר לדוגמה", "אמן לדוגמה", "אלבום לדוגמה")
    assert (a["live"]["shuffle"], a["live"]["repeat"], a["live"]["now"]["duration_s"], a["live"]["now"]["position_s"], a["live"]["volume"]["level"]) == (False, "off", 200, 50, 40)
    assert a["caps"]["shuffle"] and a["caps"]["repeat"] and a["caps"]["transport"]["seek"] and a["caps"]["group"] and a["caps"]["up_next"] and a["caps"]["transfer"]
    garden = by["רמקול גינה"]
    assert garden["music_provider"] == "vendor" and garden["caps"]["group"] is False and garden["caps"]["favourites"] is False and garden["live"]["play"] == "idle"
    den = by["מגבר קולנוע"]
    assert den["music_provider"] == "ma" and [z["id"] for z in den["zones"]] == ["main", "zone2"]
    assert [(z["power"], z["volume"], z["source_id"]) for z in den["zones"]] == [("on", 35, "TV"), ("off", 20, "Radio")]
    assert den["caps"]["sound_outputs"] == ["Stereo", "Movie", "Music"] and den["live"]["sound_output"] == "Stereo"
    d = c.get(f"{API}/devices/{keys['denon']}").json()
    assert set(d) == AUDIO_KEYS | {"sources", "apps", "recent", "remote", "model_keys"} and [s["id"] for s in d["sources"]] == ["TV", "Radio", "Game"] and d["apps"] == []


def test_a_restored_player_is_unavailable_but_keeps_its_controls_a_cast_only_speaker_that_drops_off_is_asleep(ma):
    app, c, calls, keys, settings = ma
    console = c.get(f"{API}/devices/{keys['console']}").json()
    assert (console["live"]["power"], console["live"]["caps_known"], console["live"]["since"] is not None) == ("unavailable", False, True)
    assert console["caps"]["volume_set"] is False and console["caps"]["group"] is False, "a degraded mask is never read as the device's capabilities when no good one was ever seen"
    # an MA speaker that was available and drops off keeps the last good mask
    aseed.set_state(c, "media_player.ma_b", "unavailable", supported_features=aseed.MA_DEGRADED, restored=True)
    aseed.set_state(c, "media_player.wiim_b", "unavailable", supported_features=0)
    b = c.get(f"{API}/devices/{keys['b']}").json()
    assert b["live"]["caps_known"] is False and b["live"]["power"] == "unavailable"
    assert b["caps"]["volume_set"] and b["caps"]["group"] and b["caps"]["shuffle"], "the last good mask: greyed controls, never a device without capabilities"
    aseed.set_state(c, "media_player.cast_garden", "unavailable", supported_features=0)
    g = c.get(f"{API}/devices/{keys['garden']}").json()
    assert (g["live"]["power"], g["live"]["caps_known"]) == ("off", False), "availability is per integration: a Cast speaker that drops off is asleep"


def test_filters_unplaced_floor_text_and_state(ma):
    app, c, calls, keys, settings = ma
    assert {d["name"] for d in devices(c, "kind=speaker,player,receiver,group&area=none")} == {"קונסולה", "זוג סטריאו"}
    assert {d["name"] for d in devices(c, "kind=speaker,player,receiver,group&floor=ground")} == {"רמקול סלון", "רמקול מטבח", "מגבר קולנוע", "רמקול גינה"}, "an unplaced device is in no floor"
    assert [d["name"] for d in devices(c, "kind=speaker,player,receiver,group&area=living")] == ["מגבר קולנוע", "רמקול סלון"]
    assert [d["name"] for d in devices(c, "kind=speaker,player,receiver,group&q=גינה")] == ["רמקול גינה"] and [d["name"] for d in devices(c, "kind=speaker,player,receiver,group&q=סלון")] == ["מגבר קולנוע", "רמקול סלון"]
    assert [d["name"] for d in devices(c, "kind=speaker,player,receiver,group&state=playing")] == ["רמקול סלון"]
    assert {d["name"] for d in devices(c, "kind=speaker,player,receiver,group&state=off")} == {"רמקול מטבח", "מגבר קולנוע", "רמקול גינה", "זוג סטריאו"}, "off = not playing and available"
    assert [d["name"] for d in devices(c, "kind=speaker,player,receiver,group&state=unavailable")] == ["קונסולה"]
    assert c.get(f"{API}/devices?kind=session").status_code == 422 and c.get(f"{API}/devices?kind=tablet").status_code == 422 and c.get(f"{API}/devices?kind=speaker&state=sleeping").status_code == 422


def test_an_installation_without_floors_lists_by_area_and_floor_filters_find_nothing(sonos):
    app, c, calls, keys, settings = sonos
    st = c.get(f"{API}/status").json()
    assert st["floors"] is False and st["library"] == {"provider": "sonos", "state": "ready"}
    assert {d["name"]: (d["floor_id"], d["area_id"]) for d in devices(c) if d["music_provider"] == "sonos"} == {"סלון": (None, "living"), "מטבח": (None, "kitchen"), "חדר שינה": (None, "bedroom")}
    assert devices(c, "kind=speaker,player,receiver,group&floor=ground") == []
    assert {d["name"] for d in devices(c, "kind=speaker,player,receiver,group&area=none")} == {"חדר שינה"} and len(devices(c, "kind=speaker,player,receiver,group&area=none")) == 1, "the SmartThings mirror of the bedroom has no area"


def test_status_counts_floors_and_library_of_the_ma_house(ma):
    app, c, calls, keys, settings = ma
    st = c.get(f"{API}/status").json()
    assert st["floors"] is True and st["library"] == {"provider": "ma", "state": "ready"}
    assert st["bridge"] == {"paired": True, "version": "0.5.0", "media_ready": True, "players_ready": True} and st["can"]["group"] is True
    assert st["counts"] == {"screens": 1, "on": 0, "pending_approval": 0, "players": 5, "playing": 1, "groups": 1, "unplaced": 2, "suggestions": 0}, "5 players + 1 static group; unplaced: the console and the group"
    aseed.set_state(c, "media_player.ma_a", "playing", group_members=["media_player.ma_a", "media_player.ma_b"])
    aseed.set_state(c, "media_player.ma_b", "idle", active_queue=aseed.UID_A)
    assert c.get(f"{API}/status").json()["counts"]["groups"] == 2, "a live group is one group"
    viewer = as_user("vera")
    bind(c, settings, "vera", "viewer", "installation", "*")
    v = c.get(f"{API}/status", headers=viewer).json()
    assert v["can"]["group"] is False and v["counts"]["suggestions"] is None and v["counts"]["players"] == 5


def test_the_library_status_follows_the_bridges_last_word_about_the_music_assistant_entry(ma):
    app, c, calls, keys, settings = ma
    media_query._note_entry(False)
    assert c.get(f"{API}/status").json()["library"] == {"provider": "ma", "state": "unavailable"}
    media_query._note_entry(True)
    assert c.get(f"{API}/status").json()["library"]["state"] == "ready"


# ------------------------------------------------------------------------------------------------ the dedupe ladder through the store


def test_the_model_is_one_card_per_physical_thing_with_the_music_layer_hidden_and_the_receiver_zones(ma):
    app, c, calls, keys, settings = ma
    rows = {d["name"]: d for d in c.get(f"{API}/admin/devices").json()["devices"]}
    a = rows["רמקול סלון"]
    eps = {e["endpoint_id"]: e for e in a["endpoints"]}
    assert {k: (v["role"], v["rule"], v["hidden"]) for k, v in eps.items()} == {"ha:media_player.wiim_a": ("vendor", "2c", False), "ha:media_player.cast_a": ("cast", "3b", True), "ha:media_player.ma_a": ("music", "2c", True)}
    assert {k: set(v["primary_for"]) for k, v in eps.items()} == {"ha:media_player.cast_a": set(), "ha:media_player.ma_a": {"music", "group", "now_playing"}, "ha:media_player.wiim_a": {"sources", "volume", "mute"}}
    assert a["music_provider"] == "ma"
    den = rows["מגבר קולנוע"]
    deps = {k.removeprefix("ha:media_player."): (v["role"], v["rule"], v["hidden"]) for k, v in {e["endpoint_id"]: e for e in den["endpoints"]}.items()}
    assert deps == {"denon_main": ("vendor", "device", False), "denon_zone2": ("vendor", "device", False), "heos_den": ("vendor", "2b", False), "ma_den": ("music", "2b", True)}
    assert [z["id"] for z in den["zones"]] == ["main", "zone2"] and den["kind"] == "receiver"
    primary = {c_: e["endpoint_id"] for e in den["endpoints"] for c_ in e["primary_for"]}
    assert primary["power"] == "ha:media_player.denon_main" and primary["music"] == "ha:media_player.ma_den" and primary["group"] == "ha:media_player.ma_den" and primary["sound_mode"] == "ha:media_player.denon_main"
    assert rows["טלוויזיה חדר שינה"]["kind"] == "screen" and rows["זוג סטריאו"]["kind"] == "group" and rows["רמקול גינה"]["music_provider"] == "vendor"


def test_the_sonos_house_has_mirrors_non_physical_components_and_suggestions_for_the_wizard(sonos):
    app, c, calls, keys, settings = sonos
    adm = c.get(f"{API}/admin/devices").json()
    assert adm["non_physical"] == 4 and not any(d["kind"] in ("session", "virtual_group", "service") for d in adm["devices"]), "hidden by default, counted"
    non_physical = c.get(f"{API}/admin/devices?kind=session,virtual_group,service").json()["devices"]
    assert sorted(d["kind"] for d in non_physical) == ["service", "session", "session", "virtual_group"]
    assert c.get(f"{API}/admin/devices?kind=tablet").status_code == 422
    sugg = c.get(f"{API}/admin/suggestions").json()["suggestions"]
    assert sorted((s["rule"], s["reason"]) for s in sugg) == [("5", "same_name_area"), ("5", "same_name_area"), ("5b", "same_name_area_one_side")]
    assert all(s["endpoint_label"] and s["device_name"] and len(s["id"]) == 12 for s in sugg)
    assert not any(k in json.dumps(non_physical) for k in ("RINCON",)), "no identifier"
    # nothing of the sessions, the helper or the Spotify source is ever suggested
    assert not any("jf_" in s["endpoint_id"] or "helper" in s["endpoint_id"] or "spotify" in s["endpoint_id"] for s in sugg)


def test_a_link_carries_the_endpoint_with_what_the_ladder_joined_to_it_and_a_dismiss_keeps_the_endpoint(sonos):
    app, c, calls, keys, settings = sonos
    sugg = {s["endpoint_id"]: s for s in c.get(f"{API}/admin/suggestions").json()["suggestions"]}
    dismissed = sugg["ha:media_player.st_bedroom"]
    r = c.post(f"{API}/admin/links", json={"op": "ignore", "endpoint_id": dismissed["endpoint_id"], "device_key": dismissed["device_key"]})
    assert r.status_code == 200
    assert dismissed["endpoint_id"] not in {s["endpoint_id"] for s in c.get(f"{API}/admin/suggestions").json()["suggestions"]}, "dismissed"
    assert aseed.key_with(c, "media_player.st_bedroom"), "the endpoint is still in the model: dismissing a suggestion is not ignoring the endpoint"
    take = sugg["ha:media_player.sonos_living"]
    assert c.post(f"{API}/admin/links", json={"op": "link", "endpoint_id": take["endpoint_id"], "device_key": take["device_key"]}).status_code == 200
    living = next(d for d in c.get(f"{API}/admin/devices").json()["devices"] if d["name"] == "סלון" and any(e["endpoint_id"] == "ha:media_player.sonos_living" for e in d["endpoints"]))
    roles = {e["endpoint_id"]: (e["role"], e["hidden"], e["primary_for"]) for e in living["endpoints"]}
    assert roles["ha:media_player.st_living"] == ("mirror", True, []), "a poorer cloud twin is a mirror: hidden, never a primary"
    assert [d["name"] for d in devices(c)].count("סלון") <= 2
    count_after = len(c.get(f"{API}/admin/devices").json()["devices"])
    assert count_after == 6, "one device fewer"


def test_a_user_hidden_entity_stays_a_hidden_endpoint_and_a_config_entry_disabled_one_never_enters(settings):
    c = TestClient(create_app(settings))
    h = aseed.ma_house()
    for e in h.entities:
        if e["entity_id"] == "media_player.cast_garden":
            e["hidden_by"] = "user"
    h.entity("media_player.old_wiim", "linkplay", "d_wiim_a", "off", aseed.WIIM, disabled=True, name="old")
    for i in range(0, len(h.states), 40):
        assert c.post("/api/v1/ha/dev/states", json={"states": h.states[i:i + 40]}).status_code == 200
    assert c.post("/api/v1/ha/dev/registry", json={"entities": h.entities, "devices": h.devices, "areas": h.areas, "floors": h.floors}).status_code == 200
    rows = c.get(f"{API}/admin/devices").json()["devices"]
    assert not any(e["endpoint_id"] == "ha:media_player.old_wiim" for d in rows for e in d["endpoints"])
    assert [e["hidden"] for d in rows for e in d["endpoints"] if e["endpoint_id"] == "ha:media_player.cast_garden"] == [False], "alone: the only endpoint of a device stays listed"


# ------------------------------------------------------------------------------------------------ approval by kind


def test_approving_the_players_is_one_tap_by_kind_and_never_reaches_the_non_physical_kinds(settings):
    c = TestClient(create_app(settings))
    aseed.install(c, "sonos")
    r = c.post(f"{API}/admin/approve", json={"kinds": ["speaker", "player", "receiver", "group"]})
    assert r.json() == {"requested": 6, "changed": 6, "approved": 0, "pending_approval": 1, "approved_players": 6, "pending_players": 0}
    rows = {d["kind"]: d for d in c.get(f"{API}/admin/devices?kind=session,virtual_group,service").json()["devices"]}
    assert all(d["approved"] is False for d in rows.values()), "a session, a helper group and a Spotify list are never approved by the player tap"
    assert devices(c, "kind=speaker") != [] and c.get(f"{API}/devices").json() == {"devices": []}, "screens were not approved"
    assert c.post(f"{API}/admin/approve", json={"kinds": ["speaker"], "approved": False}).json()["pending_players"] == 6
    assert c.post(f"{API}/admin/approve", json={"kinds": ["session"]}).status_code == 422
    # a helper group the administrator approves by hand is still no card of the lists
    key = aseed.key_with(c, "media_player.helper_sonos", "virtual_group")
    assert c.post(f"{API}/admin/approve", json={"device_keys": [key]}).status_code == 200
    assert not any(d["kind"] == "virtual_group" for d in devices(c)) and c.get(f"{API}/devices/{key}").status_code == 404


def test_an_unapproved_player_is_invisible_to_everyone_but_the_administration(settings):
    c = TestClient(create_app(settings))
    aseed.install(c, "ma")
    assert devices(c) == [] and c.get(f"{API}/status").json()["counts"]["players"] == 0
    key = aseed.key_with(c, "media_player.cast_garden")
    assert c.get(f"{API}/devices/{key}").status_code == 404 and c.get(f"{API}/devices/{key}/up-next").status_code == 404
    assert c.post(f"{API}/devices/{key}/commands", json=mseed.body("transport", action="play")).status_code == 404


# ------------------------------------------------------------------------------------------------ the administration of a player


def test_ceilings_and_the_night_window_are_set_per_device_and_validated(ma):
    app, c, calls, keys, settings = ma
    put = lambda body: c.put(f"{API}/admin/devices/{keys['a']}", json=body)  # noqa: E731
    assert devices(c)[0]["volume_max"] is None
    assert put({"volume_max": 40}).status_code == 200 and put({"volume_night": {"from": "22:00", "to": "07:00", "max": 20}}).status_code == 200
    row = by_name(devices(c))["רמקול סלון"]
    assert (row["volume_max"], row["volume_night"]) == (40, {"from": "22:00", "to": "07:00", "max": 20})
    admin = next(d for d in c.get(f"{API}/admin/devices").json()["devices"] if d["key"] == keys["a"])
    assert admin["volume_max"] == 40 and admin["volume_night"] == {"from": "22:00", "to": "07:00", "max": 20} and admin["music_provider"] == "ma" and admin["area_id"] == "living"
    for bad in ({"volume_night": {"from": "22:00", "to": "07:00"}}, {"volume_night": {"from": "25:00", "to": "07:00", "max": 20}}, {"volume_night": {"from": "22:00", "to": "22:00", "max": 20}},
                {"volume_night": {"from": "22:00", "to": "07:00", "max": 101}}, {"volume_night": {"from": "22:00", "to": "07:00", "max": True}}, {"volume_night": "night"},
                {"volume_night": {"from": "22:00", "to": "07:00", "max": 20, "x": 1}}, {"volume_max": 101}, {"volume_max": True}):
        assert put(bad).status_code == 422, bad
    assert put({"volume_night": None, "volume_max": None}).status_code == 200
    row = by_name(devices(c))["רמקול סלון"]
    assert (row["volume_max"], row["volume_night"]) == (None, None), "cleared: back to no ceiling"
    viewer = as_user("vera")
    bind(c, settings, "vera", "operator", "installation", "*")
    assert c.put(f"{API}/admin/devices/{keys['a']}", json={"volume_max": 10}, headers=viewer).status_code == 403, "system.configure"


def test_kinds_can_be_set_by_hand_but_a_group_is_only_detected(ma):
    app, c, calls, keys, settings = ma
    assert c.put(f"{API}/admin/devices/{keys['garden']}", json={"kind": "player"}).status_code == 200 and by_name(devices(c))["רמקול גינה"]["kind"] == "player"
    assert c.put(f"{API}/admin/devices/{keys['garden']}", json={"kind": "session"}).status_code == 200 and "רמקול גינה" not in by_name(devices(c)), "demoted to a non-physical component"
    assert c.put(f"{API}/admin/devices/{keys['garden']}", json={"kind": "group"}).status_code == 422
    assert c.put(f"{API}/admin/devices/{keys['garden']}", json={"kind": None}).status_code == 200 and by_name(devices(c))["רמקול גינה"]["kind"] == "speaker"


def test_placing_an_unplaced_device_writes_the_entity_registry_through_the_bridge_and_the_device_leaves_the_bucket(ma, monkeypatch):
    app, c, calls, keys, settings = ma
    sent: list[dict[str, Any]] = []
    monkeypatch.setattr(ha_client, "call_bridge_set_area", lambda _s, payload, timeout=15.0: (sent.append(payload), {"ok": True, "context_id": None, "request_id": payload["request_id"]})[1])
    assert keys["console"] in {d["key"] for d in devices(c, "kind=speaker,player,receiver,group&area=none")}
    r = c.put(f"{API}/admin/devices/{keys['console']}", json={"area_id": "office"})
    assert r.status_code == 200, r.text
    assert [(p["entity_id"], p["area_id"]) for p in sent] == [("media_player.ma_console", "office")] and r.json()["area_name"] == "משרד"
    placed = by_name(devices(c))["קונסולה"]
    assert (placed["area_id"], placed["floor_id"]) == ("office", "upper") and keys["console"] not in {d["key"] for d in devices(c, "kind=speaker,player,receiver,group&area=none")}
    assert c.get(f"{API}/status").json()["counts"]["unplaced"] == 1
    with app.state.db.connection(mode="read") as conn:
        rows = [dict(r) for r in conn.execute("SELECT decision, details_json FROM audit_log WHERE action = 'media.place' ORDER BY id").fetchall()]
    assert [r["decision"] for r in rows] == ["allowed", "allowed"] and json.loads(rows[0]["details_json"])["phase"] == "attempt" and json.loads(rows[1]["details_json"])["phase"] == "outcome"
    assert c.put(f"{API}/admin/devices/{keys['console']}", json={"area_id": "nowhere"}).status_code == 404
    monkeypatch.setattr(ha_client, "call_bridge_set_area", lambda _s, payload, timeout=15.0: {"ok": False, "error": "entity_not_found"})
    assert c.put(f"{API}/admin/devices/{keys['console']}", json={"area_id": "kitchen"}).status_code == 404
    assert by_name(devices(c))["קונסולה"]["area_id"] == "office", "a refused write changes nothing"


# ------------------------------------------------------------------------------------------------ the permission media.group


def test_media_group_is_registered_with_a_hebrew_label_and_the_default_roles():
    assert PERMISSION_LABELS["media.group"] == "קיבוץ רמקולים וקבוצות שמורות"
    holders = {r for r in ("viewer", "operator", "editor", "site_admin", "system_admin", "kiosk") if "media.group" in ROLES[r]}
    assert holders == {"operator", "site_admin", "system_admin"} and "media.group" not in SENSITIVE
    from pathlib import Path

    contract = json.loads((Path(__file__).resolve().parents[3] / "contracts" / "examples" / "role-catalog.design.json").read_text(encoding="utf-8"))
    assert {r["id"] for r in contract["roles"] if "media.group" in r["permissions"]} == {"operator", "site_admin", "system_admin"}
    assert "media.group" not in contract["sensitive_permissions_not_implied"]


def test_a_custom_role_may_hold_media_group_without_naming_it_sensitive(ma):
    app, c, calls, keys, settings = ma
    ok = c.post("/api/v1/access/roles", json={"name": "קיבוץ", "permissions": ["media.read", "media.control", "media.group"]})
    assert ok.status_code in (200, 201), ok.text
    bind(c, settings, "gil", ok.json()["id"], "installation", "*")
    st = c.get(f"{API}/status", headers=as_user("gil")).json()["can"]
    assert (st["read"], st["control"], st["group"], st["bulk"]) == (True, True, True, False)
    d = by_name(devices(c, headers=as_user("gil")))["רמקול סלון"]
    assert d["can"]["group"] is True and d["can"]["control"] is True
    bind(c, settings, "vera", "viewer", "installation", "*")
    assert by_name(devices(c, headers=as_user("vera")))["רמקול סלון"]["can"] == {"control": False, "power": False, "public_ok": True, "bulk": False, "group": False, "queue": False, "browse": False}


def test_can_group_is_false_where_the_device_cannot_join(ma):
    app, c, calls, keys, settings = ma
    by = by_name(devices(c))
    assert [by[n]["can"]["group"] for n in ("רמקול סלון", "רמקול מטבח", "מגבר קולנוע")] == [True, True, True]
    assert [by[n]["can"]["group"] for n in ("רמקול גינה", "קונסולה", "זוג סטריאו")] == [False, False, False], "Cast has no GROUPING, a restored player is unavailable, a static group is not joined"
    aseed.set_state(c, "media_player.wiim_b", "idle", group_members=["media_player.wiim_a", "media_player.wiim_b"])
    b = by_name(devices(c))["רמקול מטבח"]
    assert (b["live"]["group"]["conflict"], b["can"]["group"]) == (True, False), "the two layers disagree: 'קיבוץ לא תואם' and join is disabled"


# ------------------------------------------------------------------------------------------------ layout tabs, favourites, settings


def tab(order: list[str]) -> dict[str, Any]:
    return {"group_by": "floor", "floor_order": [], "pinned": order[:1], "order": order, "cards": {k: {"on": True, "size": "m", "phone_on": None, "phone_size": None} for k in order}}


def test_the_layout_document_carries_one_order_and_pinned_per_tab(ma):
    app, c, calls, keys, settings = ma
    cur = c.get(f"{API}/layout").json()
    assert cur["installation"] == media_layout.default_layout() and "tabs" not in cur["installation"], "without tabs it is exactly the CR-015 layout"
    layout = {**cur["installation"], "tabs": {"players": tab([keys["a"], keys["b"]]), "groups": tab([keys["stereo"]])}}
    r = c.put(f"{API}/layout", json={"layout": layout, "base_revision": cur["revision"]})
    assert r.status_code == 200, r.text
    got = r.json()["installation"]
    assert got["tabs"]["players"]["order"] == [keys["a"], keys["b"]] and got["tabs"]["groups"]["pinned"] == [keys["stereo"]] and "screens" not in got["tabs"]
    for bad in ({"tabs": {"gadgets": tab([])}}, {"tabs": {"players": {"order": ["x"]}}}, {"tabs": {"players": {"surprise": 1}}}, {"tabs": []}):
        assert c.put(f"{API}/layout", json={"layout": {**cur["installation"], **bad}, "base_revision": r.json()["revision"]}).status_code == 422, bad
    # a reader without media.layout sees only the keys it may read; the editor gets it whole
    bind(c, settings, "vera", "viewer", "installation", "*")
    assert c.get(f"{API}/layout", headers=as_user("vera")).json()["installation"]["tabs"]["players"]["order"] == [keys["a"], keys["b"]]
    p = c.put("/api/v1/me/prefs", json={"multimedia.personal": {"tabs": {"players": {"order": [keys["b"], keys["a"]], "cards": {keys["a"]: {"size": "l"}}}}}})
    assert p.status_code == 200 and c.get(f"{API}/layout").json()["personal"]["tabs"]["players"]["order"] == [keys["b"], keys["a"]]
    assert c.put("/api/v1/me/prefs", json={"multimedia.personal": {"tabs": {"nope": {}}}}).status_code == 422


def test_favourites_curation_is_one_list_with_an_optimistic_revision(ma):
    app, c, calls, keys, settings = ma
    cur = c.get(f"{API}/favourites").json()
    assert cur == {"kinds_on": ["favourites", "stations", "playlists"], "items": [], "revision": 0}
    ref = "a" * 24
    body = {"kinds_on": ["favourites", "stations"], "items": [{"item_ref": ref, "hidden": True, "order": 0}], "base_revision": 0}
    r = c.put(f"{API}/favourites", json=body)
    assert r.status_code == 200 and r.json() == {"kinds_on": ["favourites", "stations"], "items": [{"item_ref": ref, "hidden": True, "order": 0}], "revision": 1}
    stale = c.put(f"{API}/favourites", json=body)
    assert (stale.status_code, stale.json()["code"]) == (409, "revision_conflict")
    for bad in ({"items": [{"item_ref": "zz", "hidden": False, "order": 0}]}, {"items": [{"item_ref": ref, "hidden": False, "order": 0}] * 2}, {"items": [{"item_ref": ref, "hidden": "yes", "order": 0}]},
                {"items": [{"item_ref": ref, "hidden": False, "order": -1}]}, {"items": [{"item_ref": ref, "hidden": False, "order": 0, "x": 1}]}, {"kinds_on": ["radio"]}):
        assert c.put(f"{API}/favourites", json={**body, "base_revision": 1, **bad}).status_code == 422, bad
    assert c.get("/api/v1/settings").json()["settings"]["multimedia.favourites"] == r.json(), "the installation setting reads back as an object"
    bind(c, settings, "olga", "operator", "installation", "*")
    assert c.get(f"{API}/favourites", headers=as_user("olga")).status_code == 200 and c.put(f"{API}/favourites", json={**body, "base_revision": 1}, headers=as_user("olga")).status_code in (200, 403)
    bind(c, settings, "vera", "viewer", "installation", "*")
    assert c.put(f"{API}/favourites", json={**body, "base_revision": 1}, headers=as_user("vera")).status_code == 403
    with app.state.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'media.favourites.update'").fetchone()[0] == 1


# ------------------------------------------------------------------------------------------------ migration 0044


def test_migration_0044_applies_on_a_database_of_the_previous_release_and_keeps_the_rows(settings, tmp_path, monkeypatch):
    real = dbmod.MIGRATIONS_DIR
    older = tmp_path / "older"
    older.mkdir()
    for f in real.glob("*.sql"):
        if int(f.name.split("_", 1)[0]) <= 43:
            shutil.copy(f, older / f.name)
    monkeypatch.setattr(dbmod, "MIGRATIONS_DIR", older)
    database = dbmod.Database(settings.db_path)
    database.migrate()
    now = "2026-10-01T00:00:00Z"
    with database.connection() as conn:
        conn.execute("INSERT INTO media_devices(device_key, kind, kind_source, display_name, anchor_entity_id, approved, volume_max, created_at, updated_at) VALUES ('k1', 'speaker', 'auto', 'x', 'media_player.x', 1, 30, ?, ?)", (now, now))
        conn.execute("INSERT INTO media_device_endpoints(endpoint_id, source, ref, device_key, role, platform, rule, link_source, hidden, updated_at) VALUES ('ha:media_player.x', 'ha', 'media_player.x', 'k1', 'vendor', 'sonos', 'single', 'auto', 0, ?)", (now,))
        conn.execute("INSERT INTO device_bulk_actions(id, scope, scope_id, kind, principal_user_id, client_request_id, entity_count, status, requested_at, not_after) VALUES ('b1', 'floor', 'f', 'screens_off', 'u', 'r', 1, 'done', ?, ?)", (now, now))
    monkeypatch.setattr(dbmod, "MIGRATIONS_DIR", real)
    assert database.migrate() == [44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56], "0056 (K88); 0044 is the one under test; 0045-0047 (CR-018), 0048 (CR-017), 0049 (switch protection), 0050 (CR-020 S2), 0051-0052 and 0053-0054 (CR-023 meters, billing) follow it in the real set"
    with database.connection() as conn:
        row = dict(conn.execute("SELECT * FROM media_devices WHERE device_key = 'k1'").fetchone())
        assert (row["kind"], row["approved"], row["volume_max"], row["volume_night_json"], row["music_provider"], row["zones_json"]) == ("speaker", 1, 30, None, "none", None), "rows kept, ceilings stay NULL by default"
        for kind in ("session", "virtual_group", "service", "group", "receiver", "player", "screen"):
            conn.execute("INSERT INTO media_devices(device_key, kind, created_at, updated_at) VALUES (?, ?, ?, ?)", (f"k-{kind}", kind, now, now))
        with pytest.raises(Exception):
            conn.execute("INSERT INTO media_devices(device_key, kind, created_at, updated_at) VALUES ('bad', 'tablet', ?, ?)", (now, now))
        ep = dict(conn.execute("SELECT * FROM media_device_endpoints WHERE endpoint_id = 'ha:media_player.x'").fetchone())
        assert ep["last_features_json"] is None and ep["group_layer"] is None
        tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
        assert {"media_group_presets", "device_bulk_members", "media_devices"} <= tables and "media_devices_v2" not in tables
        assert {r[1] for r in conn.execute("PRAGMA index_list(media_devices)")} >= {"idx_media_devices_anchor"}
        assert conn.execute("SELECT origin FROM device_bulk_actions WHERE id = 'b1'").fetchone()[0] == "devices"
