"""CR-016 4.3: the reads behind "הבא בתור" and the favourites / stations / playlists lists - one signed read-only bridge question (`media_query`), a trimmed
answer, caches (queue 2 s, library 5 min), never a URI to the browser, `confirmed: false` instead of an empty queue, the leader answering for a member,
the Sonos-native path, and the administrator's curation (order, hidden, names that survive a restart)."""
from __future__ import annotations

import json
from typing import Any

import media_seed as mseed
import media_seed_audio as aseed
import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import ha_bridge, media_commands, media_query

API = "/api/v1/multimedia"
URIS = {"library://playlist/1": "ערב רגוע", "library://playlist/2": "בוקר", "library://radio/9": "רדיו תל אביב"}


class Bridge:
    """A fake `smplwise_bridge.media_query`: records every signed request (verified) and answers from `answers`."""

    def __init__(self, secret: str) -> None:
        self.secret, self.requests, self.answers = secret, [], {}
        self.default = None

    def __call__(self, _settings, payload, timeout=15.0):
        ha_bridge.verify(self.secret, payload)
        self.requests.append(payload)
        answer = self.answers.get(payload["query"], self.default)
        if callable(answer):
            answer = answer(payload)
        if answer is None:
            return {"ok": False, "request_id": payload["request_id"], "query": payload["query"], "error": "no_library"}
        return {"ok": True, "request_id": payload["request_id"], "query": payload["query"], "provider": "ma", **answer}


def queue_answer(**kw: Any) -> dict[str, Any]:
    q = {"count": 12, "index": 3, "shuffle": False, "repeat": "off", "current": {"name": "שיר נוכחי", "artist": "אמן", "album": "אלבום", "duration": 200},
         "next": {"name": "השיר הבא", "artist": "אמן ב", "album": None, "duration": 180}, **kw}
    return {"result": q}


def library_answer(payload: dict[str, Any]) -> dict[str, Any]:
    kind = payload["media_type"]
    items = [{"uri": u, "media_type": "radio" if "radio" in u else "playlist", "name": n, "artist": None} for u, n in URIS.items() if ("radio" in u) == (kind == "radio")]
    items += [{"uri": "https://evil.example/stream", "media_type": kind, "name": "כתובת"}, {"uri": "library://playlist/3", "media_type": "podcast", "name": "סוג זר"}] if kind == "playlist" else []
    return {"result": {"items": items, "offset": 0, "limit": 50}}


@pytest.fixture()
def q(settings, monkeypatch):
    media_query.clear()
    media_commands.BUCKETS.clear()
    app = create_app(settings)
    c = TestClient(app)
    aseed.install(c, "ma")
    aseed.approve_players(c)
    mseed.pair(c, monkeypatch, version="0.5.0")
    bridge = Bridge(c.get("/api/v1/ha/bridge/pairing").json()["pairing_code"])
    bridge.answers = {"queue": lambda p: queue_answer(), "library": library_answer}
    monkeypatch.setattr(media_query, "call_bridge_media_query", bridge)
    keys = {n: aseed.key_with(c, e) for n, e in {"a": "media_player.wiim_a", "b": "media_player.wiim_b", "garden": "media_player.cast_garden", "console": "media_player.ma_console",
                                                 "denon": "media_player.denon_main"}.items()}
    return app, c, bridge, keys, settings


# ------------------------------------------------------------------------------------------------ up next


def test_up_next_is_one_signed_read_as_the_caller_with_a_trimmed_answer(q, monkeypatch):
    app, c, bridge, keys, _ = q
    r = c.get(f"{API}/devices/{keys['a']}/up-next")
    assert r.status_code == 200, r.text
    body = r.json()
    assert set(body) == {"confirmed", "count", "index", "shuffle", "repeat", "current", "next", "read_at"} and body["confirmed"] is True and (body["count"], body["index"]) == (12, 3)
    assert body["current"] == {"name": "שיר נוכחי", "artist": "אמן", "album": "אלבום", "duration_s": 200} and body["next"]["name"] == "השיר הבא" and body["next"]["album"] is None
    (req,) = bridge.requests
    assert (req["query"], req["entity_id"], req["user_id"]) == ("queue", "media_player.ma_a", "dev-joni") and set(req) == {"user_id", "query", "entity_id", "request_id", "ts", "nonce", "sig"}
    c.get(f"{API}/devices/{keys['a']}/up-next")
    assert len(bridge.requests) == 1, "cached for 2 s"
    real = media_query.MONO()
    monkeypatch.setattr(media_query, "MONO", lambda: real + 5.0)  # the clock moves past the cache
    c.get(f"{API}/devices/{keys['a']}/up-next")
    assert len(bridge.requests) == 2


def test_the_detail_carries_the_queue_length_the_card_draws(q):
    app, c, bridge, keys, _ = q
    d = c.get(f"{API}/devices/{keys['a']}").json()
    assert d["live"]["queue"] == {"count": 12, "index": 3}


def test_a_failed_read_is_not_confirmed_never_an_empty_queue(q, monkeypatch):
    app, c, bridge, keys, _ = q
    for error in ("entity_unavailable", "timeout", "arguments_invalid", "entity_not_found", "HomeAssistantError"):
        media_query._QUEUES.clear()
        bridge.answers["queue"] = lambda p, e=error: {"ok": False, "request_id": p["request_id"], "query": "queue", "error": e}
        monkeypatch.setattr(media_query, "call_bridge_media_query", lambda _s, payload, timeout=15.0, e=error: {"ok": False, "request_id": payload["request_id"], "query": "queue", "error": e})
        r = c.get(f"{API}/devices/{keys['a']}/up-next")
        assert r.status_code == 200 and r.json() == {"confirmed": False, "count": None, "index": None, "shuffle": None, "repeat": None, "current": None, "next": None, "read_at": None}, error


def test_no_library_is_503_and_the_status_says_unavailable_until_the_bridge_says_otherwise(q, monkeypatch):
    app, c, bridge, keys, _ = q
    bridge.answers["queue"] = None
    r = c.get(f"{API}/devices/{keys['a']}/up-next")
    assert (r.status_code, r.json()["code"]) == (503, "no_library")
    assert c.get(f"{API}/status").json()["library"] == {"provider": "ma", "state": "unavailable"}
    bridge.answers["queue"] = lambda p: queue_answer()
    media_query._QUEUES.clear()
    assert c.get(f"{API}/devices/{keys['a']}/up-next").status_code == 200
    assert c.get(f"{API}/status").json()["library"]["state"] == "ready"


def test_a_speaker_without_a_music_layer_has_no_queue_and_the_gates_apply(q):
    app, c, bridge, keys, settings = q
    r = c.get(f"{API}/devices/{keys['garden']}/up-next")
    assert (r.status_code, r.json()["code"]) == (503, "no_library") and bridge.requests == []
    assert c.get(f"{API}/devices/{keys['console']}/up-next").json()["confirmed"] is False, "an unavailable player is not asked"
    assert c.get(f"{API}/devices/nope/up-next").status_code == 404
    assert c.post(f"{API}/admin/approve", json={"device_keys": [keys["b"]], "approved": False}).status_code == 200
    assert c.get(f"{API}/devices/{keys['b']}/up-next").status_code == 404
    bind(c, settings, "vera", "viewer", "installation", "*")
    assert c.get(f"{API}/devices/{keys['a']}/up-next", headers=as_user("vera")).status_code == 200, "reading the queue needs media.read only"
    assert c.get(f"{API}/devices/{keys['a']}/up-next", headers=as_user("nobody")).status_code == 403


def test_a_members_queue_is_its_leaders_and_the_member_key_works(q):
    app, c, bridge, keys, _ = q
    aseed.set_state(c, "media_player.ma_a", "playing", group_members=["media_player.ma_a", "media_player.ma_b"])
    aseed.set_state(c, "media_player.ma_b", "idle", active_queue=aseed.UID_A)
    r = c.get(f"{API}/devices/{keys['b']}/up-next")
    assert r.status_code == 200 and r.json()["current"]["name"] == "שיר נוכחי"
    assert [x["entity_id"] for x in bridge.requests] == ["media_player.ma_a"], "the leader is the one that plays"


def test_the_bridge_must_be_paired_and_0_5_0(settings, monkeypatch):
    media_query.clear()
    app = create_app(settings)
    c = TestClient(app)
    aseed.install(c, "ma")
    aseed.approve_players(c)
    key = aseed.key_with(c, "media_player.wiim_a")
    assert c.get(f"{API}/devices/{key}/up-next").json()["code"] == "bridge_not_paired"
    mseed.pair(c, monkeypatch, version="0.4.0")
    r = c.get(f"{API}/devices/{key}/up-next")
    assert (r.status_code, r.json()["code"], r.json()["details"]["required"]) == (503, "bridge_outdated", "0.5.0")


def test_a_sonos_player_answers_its_queue_from_its_own_attributes_without_a_bridge_call(settings, monkeypatch):
    media_query.clear()
    app = create_app(settings)
    c = TestClient(app)
    aseed.install(c, "sonos")
    aseed.approve_players(c)
    calls = []
    monkeypatch.setattr(media_query, "call_bridge_media_query", lambda *a, **k: calls.append(a) or {})
    mseed.pair(c, monkeypatch, version="0.5.0")
    key = aseed.key_with(c, "media_player.sonos_living")
    body = c.get(f"{API}/devices/{key}/up-next").json()
    assert (body["confirmed"], body["count"], body["index"], body["next"]) == (True, 12, 3, None) and body["current"]["name"] == "שיר" and calls == []


# ------------------------------------------------------------------------------------------------ the library


def test_the_library_lists_opaque_refs_never_a_uri_and_drops_what_is_not_an_ma_uri(q):
    app, c, bridge, keys, _ = q
    r = c.get(f"{API}/devices/{keys['a']}/library?kind=playlists")
    assert r.status_code == 200, r.text
    page = r.json()
    assert set(page) == {"kind", "items", "curated", "read_at", "provider"} and page["provider"] == "ma" and page["curated"] is False
    assert [i["name"] for i in page["items"]] == ["ערב רגוע", "בוקר"], "a URL and an unknown media type are never listed"
    assert all(set(i) == {"item_ref", "kind", "name", "artist", "glyph", "hue"} and len(i["item_ref"]) == 24 for i in page["items"])
    assert not [x for x in ("library://", "http", "uri") if x in json.dumps(page)]
    req = bridge.requests[0]
    assert (req["query"], req["entity_id"], req["media_type"], req["favorite"], req["limit"], req["order_by"]) == ("library", "media_player.ma_a", "playlist", False, 50, "name")
    stations = c.get(f"{API}/devices/{keys['a']}/library?kind=stations").json()
    assert [i["name"] for i in stations["items"]] == ["רדיו תל אביב"] and stations["items"][0]["glyph"] == "antenna"
    n = len(bridge.requests)
    c.get(f"{API}/devices/{keys['a']}/library?kind=playlists")
    assert len(bridge.requests) == n, "a library list is cached for 5 minutes"


def test_the_favourites_list_reads_each_media_type_marked_favourite(q):
    app, c, bridge, keys, _ = q
    c.get(f"{API}/devices/{keys['a']}/library?kind=favourites")
    assert sorted((r["media_type"], r["favorite"]) for r in bridge.requests) == [("album", True), ("artist", True), ("playlist", True), ("track", True)]


def test_library_refusals(q):
    app, c, bridge, keys, _ = q
    assert c.get(f"{API}/devices/{keys['a']}/library?kind=songs").status_code == 422 and c.get(f"{API}/devices/{keys['a']}/library").status_code == 422
    r = c.get(f"{API}/devices/{keys['garden']}/library?kind=favourites")
    assert (r.status_code, r.json()["code"], r.json()["details"]["reason"]) == (422, "not_supported", "favourites") and bridge.requests == [], "Cast has no library of its own"
    bridge.answers["library"] = None
    r = c.get(f"{API}/devices/{keys['a']}/library?kind=stations")
    assert (r.status_code, r.json()["code"]) == (503, "no_library")
    assert c.get(f"{API}/devices/{keys['a']}/library?kind=stations&offset=-1").status_code == 422


def test_the_curation_orders_and_hides_one_list_for_everyone_and_the_editor_sees_the_hidden(q):
    app, c, bridge, keys, settings = q
    items = {i["name"]: i["item_ref"] for i in c.get(f"{API}/devices/{keys['a']}/library?kind=playlists").json()["items"]}
    cur = c.get(f"{API}/favourites").json()
    put = c.put(f"{API}/favourites", json={"kinds_on": ["favourites", "stations", "playlists"], "items": [{"item_ref": items["בוקר"], "hidden": False, "order": 0}, {"item_ref": items["ערב רגוע"], "hidden": True, "order": 1}],
                                           "base_revision": cur["revision"]})
    assert put.status_code == 200 and put.json()["items"][0]["name"] == "בוקר" and put.json()["items"][1]["name"] == "ערב רגוע", "the editor gets the names it just curated"
    page = c.get(f"{API}/devices/{keys['a']}/library?kind=playlists").json()
    assert [i["name"] for i in page["items"]] == ["בוקר"] and page["curated"] is True, "the hidden item is not offered"
    all_ = c.get(f"{API}/devices/{keys['a']}/library?kind=playlists&all=1").json()
    assert [(i["name"], i["hidden"]) for i in all_["items"]] == [("בוקר", False), ("ערב רגוע", True)]
    # a holder of media.layout reads the names of hidden items from the curation - also after a restart (memory forgotten)
    media_query._ITEMS.clear()
    cur = c.get(f"{API}/favourites").json()
    assert [(i["name"], i["hidden"], i["kind"]) for i in cur["items"]] == [("בוקר", False, "playlist"), ("ערב רגוע", True, "playlist")]
    bind(c, settings, "vera", "viewer", "installation", "*")
    plain = c.get(f"{API}/favourites", headers=as_user("vera")).json()
    assert plain["items"] == [{"item_ref": items["בוקר"], "hidden": False, "order": 0}, {"item_ref": items["ערב רגוע"], "hidden": True, "order": 1}], "names only for the curation editor"
    assert [i["name"] for i in c.get(f"{API}/devices/{keys['a']}/library?kind=playlists&all=1", headers=as_user("vera")).json()["items"]] == ["בוקר"], "?all=1 needs media.layout"


def test_a_stations_only_curation_turns_a_list_off_for_the_panel(q):
    app, c, bridge, keys, _ = q
    assert c.put(f"{API}/favourites", json={"kinds_on": ["stations"], "items": [], "base_revision": 0}).json()["kinds_on"] == ["stations"]
    assert c.get(f"{API}/favourites").json()["kinds_on"] == ["stations"]


# ------------------------------------------------------------------------------------------------ Sonos native


def test_a_sonos_house_lists_its_favourites_and_stations_from_the_bridge_and_starts_one_with_select_source(settings, monkeypatch):
    media_query.clear()
    media_commands.BUCKETS.clear()
    app = create_app(settings)
    c = TestClient(app)
    aseed.install(c, "sonos")
    aseed.approve_players(c)
    calls = mseed.pair(c, monkeypatch, version="0.5.0")
    secret = c.get("/api/v1/ha/bridge/pairing").json()["pairing_code"]
    seen: list[dict[str, Any]] = []

    def fake(_s, payload, timeout=15.0):
        ha_bridge.verify(secret, payload)
        seen.append(payload)
        names = ["Radio A (תחנת רדיו)", "Evening playlist", "Line-in"]
        picked = [n for n in names if "רדיו" in n] if payload["media_type"] == "radio" else names
        return {"ok": True, "request_id": payload["request_id"], "query": "library", "provider": "sonos", "result": {"items": [{"name": n, "source": n} for n in picked], "offset": 0, "limit": 25}}

    monkeypatch.setattr(media_query, "call_bridge_media_query", fake)
    key = aseed.key_with(c, "media_player.sonos_living")
    fav = c.get(f"{API}/devices/{key}/library?kind=favourites").json()
    assert fav["provider"] == "sonos" and [i["name"] for i in fav["items"]] == ["Radio A (תחנת רדיו)", "Evening playlist", "Line-in"] and seen[0]["entity_id"] == "media_player.sonos_living"
    assert c.get(f"{API}/devices/{key}/library?kind=playlists").status_code == 422, "no playlists in a Sonos house"
    station = c.get(f"{API}/devices/{key}/library?kind=stations").json()["items"][0]
    r = mseed.send(c, key, "play_item", item_ref=fav["items"][1]["item_ref"])
    assert r.status_code == 202 and [(x["service"], x["data"]) for x in calls] == [("select_source", {"entity_id": "media_player.sonos_living", "source": "Evening playlist"})]
    media_commands.BUCKETS.clear()
    r = mseed.send(c, key, "play_item", item_ref=station["item_ref"], enqueue="add")
    assert (r.status_code, r.json()["code"], r.json()["details"]["reason"]) == (422, "not_supported", "enqueue"), "a native Sonos favourite cannot be queued"


# ------------------------------------------------------------------------------------------------ units


def test_item_refs_are_stable_opaque_and_expire(q, monkeypatch):
    app, c, bridge, keys, _ = q
    with app.state.db.connection(mode="read") as conn:
        a = media_query.make_ref(conn, "ma", "playlist", "library://playlist/1")
        assert a == media_query.make_ref(conn, "ma", "playlist", "library://playlist/1") and len(a) == 24 and a != media_query.make_ref(conn, "ma", "playlist", "library://playlist/2")
        assert a != media_query.make_ref(conn, "sonos", "playlist", "library://playlist/1")
    with app.state.db.connection(mode="read") as conn:
        ref = media_query.remember(conn, "ma", [{"uri": "library://playlist/1", "media_type": "playlist", "name": "x"}])[0]["item_ref"]
    assert media_query.resolve_item(ref)["uri"] == "library://playlist/1" and media_query.resolve_item("0" * 24) is None and media_query.resolve_item(None) is None
    real = media_query.MONO()
    monkeypatch.setattr(media_query, "MONO", lambda: real + media_query.ITEM_TTL_S + 1)
    assert media_query.resolve_item(ref) is None, "a ref is forgotten after 30 minutes"


def test_trim_library_keeps_only_playable_ma_items():
    ans = {"result": {"items": [{"uri": "library://track/1", "media_type": "track", "name": "ok", "artist": "x"}, {"uri": "file:///a.mp3", "media_type": "track", "name": "f"},
                                {"uri": "http://x/y", "media_type": "track", "name": "h"}, {"uri": "library://track/../2", "media_type": "track", "name": "d"},
                                {"uri": "library://track/3", "media_type": "weird", "name": "w"}, {"uri": "library://track/4", "media_type": "track", "name": "  "}, "junk", {"uri": 5}]}}
    assert [i["name"] for i in media_query.trim_library(ans, "ma", "favourites")] == ["ok"]
    assert media_query.trim_library({"result": "x"}, "ma", "favourites") == [] and media_query.trim_library({}, "ma", "favourites") == []
