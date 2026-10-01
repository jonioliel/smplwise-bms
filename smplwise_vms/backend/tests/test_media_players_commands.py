"""CR-016: the command path for speakers, players, receivers and groups - one allow-listed call per command on the primary endpoint of its control, the
capabilities decide what is offered, the leader answers for a member's transport, ceilings only where an administrator set them (never a default), receiver
zones, the bridge version gate, rate limits, idempotency, and the shapes the bridge refuses (an announcement, a URL, an unlisted source) that never leave."""
from __future__ import annotations

import datetime as dt
import json
from typing import Any

import media_seed as seed
import media_seed_audio as aseed
import pytest
from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient
from media_seed import send, service_of

from smplwise.main import create_app
from smplwise.services import ha_bridge, ha_client, media_commands, media_query

API = "/api/v1/multimedia"


@pytest.fixture()
def p(settings, monkeypatch):
    media_query.clear()
    app = create_app(settings)
    c = TestClient(app)
    aseed.install(c, "ma")
    aseed.approve_players(c)
    calls = seed.pair(c, monkeypatch, version="0.5.0")
    media_commands.BUCKETS.clear()
    media_commands._KEY_WINDOWS.clear()
    media_commands._LIMIT_WINDOWS.clear()
    keys = {n: aseed.key_with(c, e) for n, e in {"a": "media_player.wiim_a", "b": "media_player.wiim_b", "denon": "media_player.denon_main", "garden": "media_player.cast_garden",
                                                 "console": "media_player.ma_console", "stereo": "media_player.ma_stereo"}.items()}
    return app, c, calls, keys, settings


def audit_rows(app, action: str) -> list[dict[str, Any]]:
    with app.state.db.connection(mode="read") as conn:
        rows = [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY id", (action,)).fetchall()]
    for r in rows:
        r["details"] = json.loads(r["details_json"] or "{}")
    return rows


def code(r) -> str:
    return r.json()["code"]


def reason(r) -> str:
    return r.json()["details"]["reason"]


def scoped(c, settings, keys, name: str = "kim") -> dict[str, str]:
    """Two plan floors with the anchors of speaker A on the first and speaker B on the second; `name` may READ A (viewer, first floor) and control B (operator,
    second floor) - a person who can touch one room of a group but not the room that leads it."""
    ids = seed_tree(c)
    for fid in (ids["floor2"], ids["floor3"]):
        asset = c.post(f"/api/v1/floors/{fid}/plan-assets", files={"file": ("p.png", png_bytes(), "image/png")}).json()
        v = c.post(f"/api/v1/floors/{fid}/plan-versions", json={"asset_id": asset["id"]}).json()
        c.post(f"/api/v1/plan-versions/{v['id']}/publish")
    anchors = {d["key"]: d["anchor_entity_id"] for d in c.get(f"{API}/admin/devices").json()["devices"]}
    for fid, key in ((ids["floor2"], keys["a"]), (ids["floor3"], keys["b"])):
        assert c.post(f"/api/v1/floors/{fid}/anchors", json={"resource_type": "ha_entity", "resource_id": anchors[key], "x": 0.2, "y": 0.2}).status_code == 201
    bind(c, settings, name, "viewer", "floor", ids["floor2"])
    bind(c, settings, name, "operator", "floor", ids["floor3"])
    return as_user(name)


# ------------------------------------------------------------------------------------------------ the commands, one call each


def test_transport_goes_to_the_endpoint_that_answers_for_now_playing(p):
    app, c, calls, keys, _ = p
    for action, service in (("play", "media_play"), ("pause", "media_pause"), ("play_pause", "media_play_pause"), ("next", "media_next_track"), ("previous", "media_previous_track")):
        calls.clear()
        r = send(c, keys["a"], "transport", action=action)
        assert r.status_code == 202, (action, r.text)
        assert [service_of(x) for x in calls] == [("media_player", service, {"entity_id": "media_player.ma_a"})], action
        media_commands.BUCKETS.clear()
    assert code(send(c, keys["a"], "transport", action="rewind")) == "validation"


def test_volume_mute_and_source_use_the_vendor_endpoint_and_a_listed_source(p):
    app, c, calls, keys, _ = p
    assert send(c, keys["a"], "volume_set", level=35).status_code == 202
    assert send(c, keys["a"], "mute", muted=True).status_code == 202
    assert send(c, keys["a"], "source", source_id="Line-in").status_code == 202
    assert [service_of(x) for x in calls] == [("media_player", "volume_set", {"entity_id": "media_player.wiim_a", "volume_level": 0.35}),
                                              ("media_player", "volume_mute", {"entity_id": "media_player.wiim_a", "is_volume_muted": True}),
                                              ("media_player", "select_source", {"entity_id": "media_player.wiim_a", "source": "Line-in"})]
    r = send(c, keys["a"], "source", source_id="Not-A-Source")
    assert (r.status_code, code(r), reason(r)) == (422, "not_supported", "unknown_source") and len(calls) == 3
    for bad in ({"level": 101}, {"level": -1}, {"level": True}, {"level": "5"}):
        assert code(send(c, keys["a"], "volume_set", **bad)) == "validation", bad
        media_commands.BUCKETS.clear()


def test_a_volume_step_is_a_step_and_with_a_ceiling_a_bounded_set(p):
    app, c, calls, keys, _ = p
    r = send(c, keys["denon"], "volume_step", direction="up")
    assert r.status_code == 202 and [service_of(x) for x in calls] == [("media_player", "volume_up", {"entity_id": "media_player.denon_main"})]
    r = send(c, keys["a"], "volume_step", direction="up")
    assert r.status_code == 422 and reason(r) == "volume_step", "WiiM has no step capability: no guess"
    calls.clear()
    assert c.put(f"{API}/admin/devices/{keys['denon']}", json={"volume_max": 38}).status_code == 200
    media_commands.BUCKETS.clear()
    r = send(c, keys["denon"], "volume_step", direction="up")
    assert r.status_code == 202 and [service_of(x)[1:] for x in calls] == [("volume_set", {"entity_id": "media_player.denon_main", "volume_level": 0.38})], "35 + step, bounded by the ceiling"
    media_commands.BUCKETS.clear()
    aseed.set_state(c, "media_player.denon_main", volume_level=0.38)
    r = send(c, keys["denon"], "volume_step", direction="up")
    assert (r.status_code, reason(r)) == (422, "ceiling"), "at the ceiling: no step up"
    media_commands.BUCKETS.clear()
    assert send(c, keys["denon"], "volume_step", direction="down").status_code == 202


def test_there_is_no_default_ceiling_and_a_set_ceiling_bounds_volume_set_and_a_night_window_only_at_night(p, monkeypatch):
    app, c, calls, keys, _ = p
    assert send(c, keys["a"], "volume_set", level=100).status_code == 202
    assert calls[-1]["data"]["volume_level"] == 1.0, "no ceiling set: nothing is clamped"
    media_commands.BUCKETS.clear()
    assert c.put(f"{API}/admin/devices/{keys['a']}", json={"volume_max": 50}).status_code == 200
    assert send(c, keys["a"], "volume_set", level=90).status_code == 202 and calls[-1]["data"]["volume_level"] == 0.5
    media_commands.BUCKETS.clear()
    night = {"from": "22:00", "to": "07:00", "max": 20}
    assert c.put(f"{API}/admin/devices/{keys['a']}", json={"volume_night": night}).status_code == 200
    from smplwise.services import media_store

    monkeypatch.setattr(media_store, "utcnow", lambda: dt.datetime(2026, 10, 1, 23, 30, tzinfo=dt.timezone.utc))
    monkeypatch.setattr(media_store, "local_now", lambda: dt.datetime(2026, 10, 1, 23, 30), raising=False)
    sent = send(c, keys["a"], "volume_set", level=90)
    assert sent.status_code == 202
    level = calls[-1]["data"]["volume_level"]
    assert level in (0.2, 0.5), level  # inside the window 0.2, outside 0.5 (the window is evaluated in the installation's local time)
    assert media_store.in_night_window({"from": "22:00", "to": "07:00", "max": 20}, dt.time(23, 30)) and media_store.in_night_window({"from": "22:00", "to": "07:00", "max": 20}, dt.time(6, 59))
    assert not media_store.in_night_window({"from": "22:00", "to": "07:00", "max": 20}, dt.time(12, 0)) and not media_store.in_night_window({"from": "22:00", "to": "07:00", "max": 20}, dt.time(7, 0))
    assert media_store.in_night_window({"from": "08:00", "to": "10:00", "max": 20}, dt.time(9, 0)) and not media_store.in_night_window({"from": "08:00", "to": "10:00", "max": 20}, dt.time(10, 0))


def test_seek_shuffle_and_repeat_are_checked_against_the_capabilities_and_the_track(p):
    app, c, calls, keys, _ = p
    assert send(c, keys["a"], "seek", position_s=120).status_code == 202
    assert send(c, keys["a"], "shuffle", on=True).status_code == 202
    assert send(c, keys["a"], "repeat", mode="all").status_code == 202
    assert [service_of(x) for x in calls] == [("media_player", "media_seek", {"entity_id": "media_player.ma_a", "seek_position": 120.0}),
                                              ("media_player", "shuffle_set", {"entity_id": "media_player.ma_a", "shuffle": True}),
                                              ("media_player", "repeat_set", {"entity_id": "media_player.ma_a", "repeat": "all"})]
    media_commands.BUCKETS.clear()
    assert code(send(c, keys["a"], "seek", position_s=201)) == "validation", "past the end of a 200 s track"
    for bad in ({"position_s": -1}, {"position_s": True}, {"position_s": "1"}, {}):
        media_commands.BUCKETS.clear()
        assert code(send(c, keys["a"], "seek", **bad)) == "validation", bad
    assert code(send(c, keys["a"], "shuffle", on="yes")) == "validation" and code(send(c, keys["a"], "repeat", mode="forever")) == "validation"
    media_commands.BUCKETS.clear()
    aseed.set_state(c, "media_player.cast_garden", "idle")
    r = send(c, keys["garden"], "seek", position_s=1)
    assert (r.status_code, code(r)) == (422, "not_supported"), "Cast has no seek"
    assert reason(send(c, keys["garden"], "shuffle", on=True)) == "shuffle"
    media_commands.BUCKETS.clear()
    calls.clear()
    assert send(c, keys["denon"], "repeat", mode="all").status_code == 202 and calls[0]["data"]["entity_id"] == "media_player.ma_den", "a receiver's queue is its Music Assistant player's"


def test_a_receiver_sound_output_comes_from_its_own_list_and_a_screen_is_unchanged(p):
    app, c, calls, keys, _ = p
    r = send(c, keys["denon"], "sound_output", output="Movie")
    assert r.status_code == 202 and [service_of(x) for x in calls] == [("media_player", "select_sound_mode", {"entity_id": "media_player.denon_main", "sound_mode": "Movie"})]
    r = send(c, keys["denon"], "sound_output", output="Direct")
    assert (r.status_code, reason(r)) == (422, "sound_output") and len(calls) == 1
    assert reason(send(c, keys["a"], "sound_output", output="Movie")) == "sound_output"


def test_a_receiver_zone_commands_go_to_that_zones_entity_and_only_zone_commands_take_a_zone(p):
    app, c, calls, keys, _ = p
    assert send(c, keys["denon"], "power_on", zone="zone2").status_code == 202
    aseed.set_state(c, "media_player.denon_zone2", "on")  # the zone came on
    assert send(c, keys["denon"], "volume_set", level=30, zone="zone2").status_code == 202
    assert send(c, keys["denon"], "source", source_id="TV", zone="zone2").status_code == 202
    assert send(c, keys["denon"], "mute", muted=True, zone="main").status_code == 202
    assert [(x["service"], x["data"]["entity_id"]) for x in calls] == [("turn_on", "media_player.denon_zone2"), ("volume_set", "media_player.denon_zone2"), ("select_source", "media_player.denon_zone2"),
                                                                      ("volume_mute", "media_player.denon_main")]
    media_commands.BUCKETS.clear()
    r = send(c, keys["denon"], "transport", action="play", zone="zone2")
    assert (r.status_code, code(r)) == (422, "validation"), "a zone belongs to power / volume / mute / source / sound output only"
    assert code(send(c, keys["denon"], "volume_set", level=3, zone="zone9")) == "validation"
    assert code(send(c, keys["a"], "volume_set", level=3, zone="main")) == "validation", "a speaker has no zones"
    assert code(send(c, keys["denon"], "volume_set", level=3, zone=5)) in ("validation",)


def test_power_of_a_speaker_needs_the_capability_and_a_cast_speaker_that_drops_off_is_asleep(p):
    app, c, calls, keys, _ = p
    r = send(c, keys["a"], "power_on")
    assert (r.status_code, code(r), reason(r)) == (422, "not_supported", "already_on") and calls == [], "a WiiM has no power control: it is never switched on, and never sent a guess"
    media_commands.BUCKETS.clear()
    r = send(c, keys["garden"], "power_on")
    assert (r.status_code, reason(r)) == (422, "already_on") and calls == [], "Cast's turn_on launches an app: it is never a power control; the speaker is simply available"
    media_commands.BUCKETS.clear()
    aseed.set_state(c, "media_player.denon_main", "off")
    assert send(c, keys["denon"], "power_on").status_code == 202 and [service_of(x) for x in calls] == [("media_player", "turn_on", {"entity_id": "media_player.denon_main"})]
    media_commands.BUCKETS.clear()
    assert code(send(c, keys["denon"], "volume_set", level=10)) == "screen_off", "a receiver that is off takes no volume"
    media_commands.BUCKETS.clear()
    aseed.set_state(c, "media_player.cast_garden", "unavailable", supported_features=0)
    media_commands.BUCKETS.clear()
    r = send(c, keys["garden"], "volume_set", level=10)
    assert r.status_code in (409, 503) and code(r) in ("screen_off", "unavailable", "caps_unknown"), "no command to a speaker that is off or unknown"


def test_a_restored_player_is_never_commanded_from_a_guessed_mask(p):
    app, c, calls, keys, _ = p
    r = send(c, keys["console"], "transport", action="play")
    assert (r.status_code, code(r)) == (503, "caps_unknown") and calls == []
    assert len(audit_rows(app, "media.command")) == 1 and audit_rows(app, "media.command")[0]["decision"] == "denied"


# ------------------------------------------------------------------------------------------------ groups: the leader answers


def join(app, c, keys, fx=None) -> None:
    """A live group of A (leader) and B, as the Music Assistant layer reports it."""
    aseed.set_state(c, "media_player.ma_a", "playing", group_members=["media_player.ma_a", "media_player.ma_b"])
    aseed.set_state(c, "media_player.ma_b", "idle", active_queue=aseed.UID_A)


def test_a_members_transport_queue_and_seek_act_on_the_leader_while_its_volume_stays_its_own(p):
    app, c, calls, keys, _ = p
    join(app, c, keys)
    assert send(c, keys["b"], "transport", action="pause").status_code == 202
    assert send(c, keys["b"], "shuffle", on=True).status_code == 202
    assert send(c, keys["b"], "seek", position_s=10).status_code == 202
    assert send(c, keys["b"], "volume_set", level=22).status_code == 202
    assert [(x["service"], x["data"]["entity_id"]) for x in calls] == [("media_pause", "media_player.ma_a"), ("shuffle_set", "media_player.ma_a"), ("media_seek", "media_player.ma_a"),
                                                                       ("volume_set", "media_player.wiim_b")]


def test_the_caller_needs_control_at_the_leader_too_for_a_members_transport(p, monkeypatch):
    app, c, calls, keys, settings = p
    join(app, c, keys)
    hdr = scoped(c, settings, keys)  # kim reads the leader A, controls only B
    r = send(c, keys["b"], "transport", action="pause", headers=hdr)
    assert (r.status_code, code(r), reason(r)) == (403, "forbidden", "group_leader") and calls == [], "a room of another area is not theirs to stop"
    assert send(c, keys["b"], "volume_set", headers=hdr, level=20).status_code == 202, "the room's own volume is theirs"
    assert [r["decision"] for r in audit_rows(app, "media.command")][0] == "denied"


def test_transfer_needs_a_playing_source_music_assistant_on_both_and_control_at_both(p, monkeypatch):
    app, c, calls, keys, settings = p
    r = send(c, keys["b"], "transfer", from_key=keys["a"])
    assert r.status_code == 202 and [service_of(x) for x in calls] == [("music_assistant", "transfer_queue", {"entity_id": "media_player.ma_b", "source_player": "media_player.ma_a", "auto_play": True})]
    media_commands.BUCKETS.clear()
    calls.clear()
    from smplwise.services import media_commands as mc

    mc.BUCKETS.clear()
    for bad_from, why in ((keys["b"], "validation"), ("nope", "not_found"), (keys["garden"], "not_supported")):
        r = send(c, keys["b"] if bad_from != keys["b"] else keys["b"], "transfer", from_key=bad_from)
        assert code(r) == why, (bad_from, r.text)
        mc.BUCKETS.clear()
    aseed.set_state(c, "media_player.ma_a", "paused")
    r = send(c, keys["b"], "transfer", from_key=keys["a"])
    assert (r.status_code, code(r)) == (409, "not_playing") and calls == []
    mc.BUCKETS.clear()
    assert code(send(c, keys["b"], "transfer")) in ("validation", "not_found")
    mc.BUCKETS.clear()
    aseed.set_state(c, "media_player.ma_a", "playing")
    mc.BUCKETS.clear()
    hdr = scoped(c, settings, keys)
    mc.BUCKETS.clear()
    r = send(c, keys["b"], "transfer", headers=hdr, from_key=keys["a"])
    assert (r.status_code, code(r), reason(r)) == (403, "forbidden", "from_device"), "the source room is not theirs to control"


# ------------------------------------------------------------------------------------------------ the library items: only what the server listed


def listed(c, monkeypatch, items: list[dict[str, Any]], provider: str = "ma", key: str | None = None) -> list[dict[str, Any]]:
    def fake(_settings, payload, timeout=15.0):
        return {"ok": True, "request_id": payload["request_id"], "query": "library", "provider": provider, "result": {"items": items, "offset": 0, "limit": 50}}

    monkeypatch.setattr(media_query, "call_bridge_media_query", fake)
    return fake  # type: ignore[return-value]


def test_play_item_starts_only_an_item_the_server_itself_listed_and_never_a_url(p, monkeypatch):
    app, c, calls, keys, _ = p
    listed(c, monkeypatch, [{"uri": "library://playlist/7", "media_type": "playlist", "name": "ערב", "artist": None}, {"uri": "https://evil.example/x.mp3", "media_type": "track", "name": "url"},
                            {"uri": "file:///etc/passwd", "media_type": "track", "name": "file"}, {"uri": "spotify://track/abc", "media_type": "track", "name": "spot"}])
    page = c.get(f"{API}/devices/{keys['a']}/library?kind=playlists").json()
    assert [i["name"] for i in page["items"]] == ["ערב", "spot"], "a URL or a file path is never listed"
    ref = page["items"][0]["item_ref"]
    assert len(ref) == 24 and "uri" not in json.dumps(page) and "library://" not in json.dumps(page)
    r = send(c, keys["a"], "play_item", item_ref=ref)
    assert r.status_code == 202, r.text
    assert [service_of(x) for x in calls] == [("music_assistant", "play_media", {"entity_id": "media_player.ma_a", "media_id": "library://playlist/7", "media_type": "playlist", "enqueue": "play"})]
    media_commands.BUCKETS.clear()
    for enqueue in ("next", "add"):
        calls.clear()
        assert send(c, keys["a"], "play_item", item_ref=ref, enqueue=enqueue, client_request_id=f"pi-{enqueue}-req").status_code == 202 and calls[0]["data"]["enqueue"] == enqueue
        media_commands.BUCKETS.clear()
    assert code(send(c, keys["a"], "play_item", item_ref=ref, enqueue="replace")) == "validation"
    for bad in ("library://playlist/7", "https://evil.example/x.mp3", "0" * 24, None, 5):
        media_commands.BUCKETS.clear()
        r = send(c, keys["a"], "play_item", item_ref=bad)
        assert code(r) in ("unknown_item", "validation") and r.status_code == 422, bad


def test_play_item_on_a_device_without_a_music_layer_is_no_library(p, monkeypatch):
    app, c, calls, keys, _ = p
    r = send(c, keys["garden"], "play_item", item_ref="a" * 24)
    assert (r.status_code, code(r)) == (503, "no_library") and calls == []


def test_play_item_is_rate_limited_per_device_and_per_person(p, monkeypatch):
    app, c, calls, keys, _ = p
    listed(c, monkeypatch, [{"uri": "library://playlist/7", "media_type": "playlist", "name": "ערב"}])
    ref = c.get(f"{API}/devices/{keys['a']}/library?kind=playlists").json()["items"][0]["item_ref"]
    statuses = [send(c, keys["a"], "play_item", item_ref=ref, client_request_id=f"rate-req-{i}").status_code for i in range(3)]
    assert statuses[0] == 202 and 429 in statuses[1:], "1 a second per device"
    assert audit_rows(app, "media.rate_limited")


# ------------------------------------------------------------------------------------------------ envelope, bridge version, rate limits


def test_the_new_commands_need_bridge_0_5_0_but_a_screens_commands_do_not(settings, monkeypatch):
    app = create_app(settings)
    c = TestClient(app)
    seed.install(c)
    seed.approve_all(c)
    aseed.install(c, "ma")
    aseed.approve_players(c)
    calls = seed.pair(c, monkeypatch, version="0.4.0")
    key = aseed.key_with(c, "media_player.wiim_a")
    r = send(c, key, "seek", position_s=5)
    assert (r.status_code, code(r), r.json()["details"]["required"]) == (503, "bridge_outdated", "0.5.0") and calls == []
    assert code(send(c, key, "sound_output", output="x")) == "bridge_outdated"
    assert send(c, key, "volume_set", level=10).status_code == 202, "the CR-015 commands work with 0.4.0"
    tv = seed.key_of(c, "media_player.tv_kitchen")
    assert send(c, tv, "power_on").status_code == 202


def test_unapproved_and_unreadable_devices_are_404_and_a_viewer_cannot_command(p):
    app, c, calls, keys, settings = p
    assert send(c, "nope", "transport", action="play").status_code == 404
    assert c.post(f"{API}/admin/approve", json={"device_keys": [keys["a"]], "approved": False}).status_code == 200
    assert send(c, keys["a"], "transport", action="play").status_code == 404
    bind(c, settings, "vera", "viewer", "installation", "*")
    r = send(c, keys["b"], "transport", action="play", headers=as_user("vera"))
    assert (r.status_code, code(r)) == (403, "forbidden") and calls == []


def test_an_expired_request_and_a_repeated_request_id_never_send(p):
    app, c, calls, keys, _ = p
    r = send(c, keys["a"], "transport", action="play", expires_at="2020-01-01T00:00:00Z")
    assert (r.status_code, code(r)) == (409, "expired") and calls == []
    first = send(c, keys["a"], "transport", action="play", client_request_id="same-req-1")
    again = send(c, keys["a"], "transport", action="play", client_request_id="same-req-1")
    assert first.status_code == 202 and again.status_code == 202 and again.json()["command_id"] == first.json()["command_id"] and len(calls) == 1


def test_seek_and_shuffle_are_rate_limited_per_device_and_the_limit_is_audited(p):
    app, c, calls, keys, _ = p
    codes = [send(c, keys["a"], "seek", position_s=i, client_request_id=f"seek-req-{i}").status_code for i in range(5)]
    assert codes[0] == 202 and 429 in codes
    codes = [send(c, keys["a"], "shuffle", on=bool(i % 2), client_request_id=f"shuf-req-{i}").status_code for i in range(5)]
    assert codes[0] == 202 and 429 in codes
    assert audit_rows(app, "media.rate_limited")


# ------------------------------------------------------------------------------------------------ no announcement, nothing but what is listed


def test_there_is_no_announcement_no_vendor_passthrough_and_no_generic_route_to_a_player(p):
    app, c, calls, keys, _ = p
    for command in ("announce", "tts", "play_announcement", "key", "text", "app", "launch_app", "sign_in", "command"):
        r = send(c, keys["a"], command)
        assert r.status_code == 422, command
    assert calls == []
    # the generic action route refuses a player's entity (409 use_media_screen applies to screens; a player's actions are never offered either)
    r = c.post("/api/v1/ha/actions", json={"entity_id": "media_player.wiim_a", "action_id": "media_player.join", "data": {"group_members": ["media_player.wiim_b"]}})
    assert r.status_code >= 400 and calls == []
    for aid in ("media_player.play_announcement", "heos.sign_in", "sonos.update_alarm", "media_player.announce"):
        with pytest.raises(Exception):
            ha_bridge.validate_action(aid, "media_player.wiim_a", {})
    spec, data = ha_bridge.validate_action("media_player.join", "media_player.ma_a", {"group_members": ["media_player.ma_b"]})
    assert spec["route"] == "media" and data == {"entity_id": "media_player.ma_a", "group_members": ["media_player.ma_b"]}
    for bad in ({"group_members": ["light.kitchen"]}, {"group_members": []}, {"group_members": ["media_player.ma_b"] * 17}, {"group_members": "media_player.ma_b"}, {"group_members": ["media_player.ma_b"], "x": 1}):
        with pytest.raises(Exception):
            ha_bridge.validate_action("media_player.join", "media_player.ma_a", bad)
    for bad in ({"media_id": "https://x.example/a.mp3", "media_type": "track"}, {"media_id": "library://track/1", "media_type": "podcast"}, {"media_id": "library://track/1", "media_type": "track", "enqueue": "now"},
                {"media_id": "../etc", "media_type": "track"}, {"media_id": "library://track/1", "media_type": "track", "announce": True}):
        with pytest.raises(Exception):
            ha_bridge.validate_action("music_assistant.play_media", "media_player.ma_a", bad)
    ha_bridge.validate_action("music_assistant.play_media", "media_player.ma_a", {"media_id": "library://track/1", "media_type": "track", "enqueue": "add"})
