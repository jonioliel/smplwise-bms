"""CR-016 bridge 0.5.0: the player / group allow-list of `media_policy.py` (decided without trusting the add-on), the read-only `media_query` service
(`media_query_service.py`, run against a fake Home Assistant), and the drift tests that keep the bridge's closed sets equal to the add-on's. The modules are
loaded by path (no Home Assistant)."""
from __future__ import annotations

import asyncio
import json
from types import SimpleNamespace
from typing import Any

import pytest
from bridge_loader import MIRROR, SRC, init_allowed_services, load

from smplwise.services import ha_bridge, media_profiles as mp

policy = load("media_policy")
const = load("const")
svc = load("media_query_service")

GROUPING = 524288
ATTRS: dict[str, dict[str, Any]] = {
    "media_player.ma_a": {"supported_features": GROUPING | 512, "sound_mode_list": ["Stereo", "Movie"], "source_list": ["Line-in"]},
    "media_player.ma_b": {"supported_features": GROUPING},
    "media_player.ma_c": {"supported_features": GROUPING},
    "media_player.cast": {"supported_features": 512},
    "media_player.heos": {"supported_features": GROUPING},
    "media_player.denon": {"supported_features": 0, "sound_mode_list": ["Stereo", "Movie"], "sound_mode": "Stereo"},
}
PLATFORMS = {"media_player.ma_a": "music_assistant", "media_player.ma_b": "music_assistant", "media_player.ma_c": "music_assistant", "media_player.heos": "heos", "media_player.cast": "cast",
             "media_player.denon": "denonavr"}


def attrs(entity_id: str) -> dict[str, Any] | None:
    return ATTRS.get(entity_id)


def check(domain: str, service: str, data: Any, platform: bool = True) -> str | None:
    return policy.refusal(domain, service, data, attrs, PLATFORMS.get if platform else None)


# ------------------------------------------------------------------------------------------------ the new services


def test_the_players_services_are_allow_listed_and_the_dangerous_ones_are_not():
    allowed = init_allowed_services()
    for pair in (("media_player", "media_seek"), ("media_player", "shuffle_set"), ("media_player", "repeat_set"), ("media_player", "select_sound_mode"), ("media_player", "join"),
                 ("media_player", "unjoin"), ("music_assistant", "play_media"), ("music_assistant", "transfer_queue")):
        assert pair in allowed and pair in policy.MEDIA_SERVICES, pair
    for pair in (("music_assistant", "play_announcement"), ("media_player", "play_announcement"), ("heos", "sign_in"), ("heos", "sign_out"), ("sonos", "update_alarm"), ("sonos", "snapshot"),
                 ("group", "set"), ("group", "remove"), ("cast", "show_lovelace_view"), ("denonavr", "get_command"), ("jellyfin", "anything"), ("music_assistant", "get_queue"),
                 ("music_assistant", "get_library"), ("music_assistant", "search"), ("media_player", "toggle")):
        assert pair not in allowed, pair
    for pair in policy.NEVER_SERVICES:
        assert pair not in allowed
    assert check("music_assistant", "play_announcement", {"entity_id": "media_player.ma_a", "url": "https://x/a.mp3"}) == "media_service_refused"
    assert check("heos", "sign_in", {}) == "media_service_refused" and check("sonos", "update_alarm", {}) == "media_service_refused" and check("jellyfin", "x", {}) == "media_service_refused"


def test_play_media_through_music_assistant_never_takes_a_url_a_file_or_a_foreign_entity():
    ok = {"entity_id": "media_player.ma_a", "media_id": "library://playlist/7", "media_type": "playlist", "enqueue": "next"}
    assert check("music_assistant", "play_media", ok) is None
    assert check("music_assistant", "play_media", {k: v for k, v in ok.items() if k != "enqueue"}) is None
    for bad_id in ("https://x.example/a.mp3", "http://x/y", "file:///etc/passwd", "ftp://x/y", "rtsp://cam/stream", "smb://nas/share", "data:audio/mp3;base64,AAAA", "javascript://x", "/local/path.mp3",
                   "library://x/../y", "library://x/%2e%2e/y", "library://x y", "library://x\ny", "", "x" * 301, 5, None, "url://x"):
        assert check("music_assistant", "play_media", {**ok, "media_id": bad_id}) in ("media_uri_refused", "media_arguments"), bad_id
    assert check("music_assistant", "play_media", {**ok, "media_type": "podcast"}) == "media_arguments"
    assert check("music_assistant", "play_media", {**ok, "enqueue": "now"}) == "media_arguments"
    assert check("music_assistant", "play_media", {**ok, "announce": True}) == "media_arguments"
    assert check("music_assistant", "play_media", {**ok, "entity_id": "media_player.heos"}) == "media_entity", "only an entity of the Music Assistant integration"
    assert check("music_assistant", "play_media", ok, platform=False) == "media_entity", "no platform lookup: refused, never assumed"
    assert check("music_assistant", "play_media", {**ok, "entity_id": "light.kitchen"}) == "media_entity"
    assert check("media_player", "play_media", {"entity_id": "media_player.ma_a", "media_content_type": "music", "media_content_id": "https://x/a.mp3"}) == "media_play_media_type", "the CR-015 service still takes keys and text only"


def test_transfer_queue_is_between_two_music_assistant_players():
    assert check("music_assistant", "transfer_queue", {"entity_id": "media_player.ma_a", "source_player": "media_player.ma_b", "auto_play": True}) is None
    assert check("music_assistant", "transfer_queue", {"entity_id": "media_player.ma_a", "source_player": "media_player.ma_a"}) == "media_arguments"
    assert check("music_assistant", "transfer_queue", {"entity_id": "media_player.ma_a", "source_player": "media_player.heos"}) == "media_entity"
    assert check("music_assistant", "transfer_queue", {"entity_id": "media_player.heos", "source_player": "media_player.ma_a"}) == "media_entity"
    assert check("music_assistant", "transfer_queue", {"entity_id": "media_player.ma_a", "source_player": "light.x"}) == "media_arguments"
    assert check("music_assistant", "transfer_queue", {"entity_id": "media_player.ma_a", "source_player": "media_player.ma_b", "auto_play": "yes"}) == "media_arguments"
    assert check("music_assistant", "transfer_queue", {"entity_id": "media_player.ma_a", "source_player": "media_player.ma_b", "extra": 1}) == "media_arguments"


def test_a_join_needs_every_member_to_report_grouping_now_one_layer_and_only_media_players():
    base = {"entity_id": "media_player.ma_a", "group_members": ["media_player.ma_b", "media_player.ma_c"]}
    assert check("media_player", "join", base) is None
    assert check("media_player", "join", {**base, "group_members": ["media_player.cast"]}) == "media_group_refused", "a Cast entity can never group"
    assert check("media_player", "join", {**base, "group_members": ["media_player.heos"]}) == "media_group_refused", "one layer per group: no mix of Music Assistant and a vendor"
    assert check("media_player", "join", {**base, "group_members": ["media_player.ma_b"]}, platform=False) is None, "without a platform lookup the grouping bit alone decides"
    assert check("media_player", "join", {**base, "group_members": ["light.kitchen"]}) == "media_group_refused"
    assert check("media_player", "join", {**base, "group_members": ["media_player.ma_a"]}) == "media_group_refused", "a leader in its own member list"
    assert check("media_player", "join", {**base, "group_members": ["media_player.ma_b", "media_player.ma_b"]}) == "media_arguments"
    assert check("media_player", "join", {**base, "group_members": []}) == "media_arguments"
    assert check("media_player", "join", {**base, "group_members": [f"media_player.x{i}" for i in range(16)]}) == "media_arguments"
    assert check("media_player", "join", {**base, "group_members": "media_player.ma_b"}) == "media_arguments"
    assert check("media_player", "join", {**base, "x": 1}) == "media_arguments"
    assert check("media_player", "join", {"entity_id": "media_player.nope", "group_members": ["media_player.ma_b"]}) == "media_group_refused"
    assert check("media_player", "unjoin", {"entity_id": "media_player.ma_a"}) is None
    assert check("media_player", "unjoin", {"entity_id": "media_player.cast"}) == "media_group_refused"
    assert check("media_player", "unjoin", {"entity_id": "media_player.ma_a", "x": 1}) == "media_arguments"


def test_seek_shuffle_repeat_and_sound_mode_arguments_are_closed_sets():
    ent = {"entity_id": "media_player.ma_a"}
    assert check("media_player", "media_seek", {**ent, "seek_position": 12.5}) is None
    for bad in (-1, True, "5", None, float("nan"), 86401):
        assert check("media_player", "media_seek", {**ent, "seek_position": bad}) == "media_arguments", bad
    assert check("media_player", "shuffle_set", {**ent, "shuffle": True}) is None and check("media_player", "shuffle_set", {**ent, "shuffle": 1}) == "media_arguments"
    for mode in ("off", "one", "all"):
        assert check("media_player", "repeat_set", {**ent, "repeat": mode}) is None
    assert check("media_player", "repeat_set", {**ent, "repeat": "forever"}) == "media_arguments"
    assert check("media_player", "select_sound_mode", {**ent, "sound_mode": "Movie"}) is None
    assert check("media_player", "select_sound_mode", {**ent, "sound_mode": "Direct"}) == "media_sound_mode_not_listed", "validated against the CURRENT sound_mode_list"
    assert check("media_player", "select_sound_mode", {"entity_id": "media_player.cast", "sound_mode": "Movie"}) == "media_sound_mode_not_listed"
    assert check("media_player", "select_sound_mode", {**ent, "sound_mode": "Movie\n"}) == "media_sound_mode_not_listed"


# ------------------------------------------------------------------------------------------------ drift against the add-on


def test_the_music_assistant_uri_rules_equal_the_add_ons():
    assert policy.MA_MEDIA_TYPES == mp.MA_MEDIA_TYPES and policy.MA_ENQUEUE == mp.MA_ENQUEUE and policy.BANNED_URI_SCHEMES == mp.BANNED_URI_SCHEMES and policy.MA_URI_MAX == mp.MA_URI_MAX
    samples = ["library://playlist/1", "spotify://track/abc", "https://x/y", "file:///a", "a" * 300, "x://" + "a" * 300, "library://a/../b", "library://a b", "ytmusic://playlist/PL1", "builtin://x", "", None, 4,
               "library://a\x00b", "LIBRARY://x/1", "ma://x%2E%2e/y", "://x", "library:/x"]
    for s in samples:
        assert policy.ma_uri_problem(s) == (mp.ma_uri_problem(s) is not None), repr(s)


def test_the_new_services_and_arguments_equal_the_add_ons_actions():
    for action_id in ("media_player.media_seek", "media_player.shuffle_set", "media_player.repeat_set", "media_player.select_sound_mode", "media_player.join", "media_player.unjoin",
                      "music_assistant.play_media", "music_assistant.transfer_queue"):
        spec = ha_bridge.ACTIONS[action_id]
        assert spec["route"] == "media" and (spec["domain"], spec["service"]) in policy.MEDIA_SERVICES
        assert policy.ALLOWED_ARGS[(spec["domain"], spec["service"])] == frozenset(spec["args"]), action_id
    assert not [a for a in ha_bridge.ACTIONS if "announce" in a or "sign_in" in a or "update_alarm" in a]
    assert not [a for a in ha_bridge.ACTIONS.values() if a["domain"] in policy.NEVER_DOMAINS]


def test_version_manifest_services_yaml_and_mirror_agree():
    manifest = json.loads((SRC / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["version"] == const.VERSION == "0.5.0" == (json.loads((MIRROR / "manifest.json").read_text(encoding="utf-8")))["version"]
    assert const.SERVICE_MEDIA_QUERY == "media_query"
    assert "media_query:" in (SRC / "services.yaml").read_text(encoding="utf-8")
    for name in ("media_policy.py", "media_query_service.py", "__init__.py", "const.py", "services.yaml", "manifest.json"):
        assert (SRC / name).read_bytes() == (MIRROR / name).read_bytes(), name
    from smplwise.services import media_store

    assert media_store.BRIDGE_PLAYERS_REQUIRED == const.VERSION


# ------------------------------------------------------------------------------------------------ media_query: what may be asked


def test_query_refusal_is_a_closed_set_with_no_config_entry_and_no_search():
    ok_lib = {"media_type": "playlist", "favorite": True, "limit": 50, "offset": 0, "order_by": "name", "entity_id": "media_player.ma_a"}
    assert policy.query_refusal("queue", {"entity_id": "media_player.ma_a"}) is None and policy.query_refusal("library", ok_lib) is None and policy.query_refusal("library", {"media_type": "radio"}) is None
    assert policy.query_refusal("search", {"entity_id": "media_player.ma_a"}) == "query_not_allowed" and policy.query_refusal(None, {}) == "query_not_allowed"
    assert policy.query_refusal("queue", {}) == "arguments_invalid" and policy.query_refusal("queue", {"entity_id": "light.x"}) == "arguments_invalid"
    for extra in ({"config_entry_id": "abc"}, {"search": "x"}, {"item_id": "1"}, {"user_id": "u"}):
        assert policy.query_refusal("library", {**ok_lib, **extra}) == "arguments_invalid", extra
        assert policy.query_refusal("queue", {"entity_id": "media_player.ma_a", **extra}) == "arguments_invalid"
    for key, bad in (("media_type", "podcast"), ("favorite", "yes"), ("limit", 0), ("limit", 101), ("limit", True), ("offset", -1), ("offset", 5001), ("order_by", "random"), ("entity_id", "../x")):
        assert policy.query_refusal("library", {**ok_lib, key: bad}) == "arguments_invalid", (key, bad)
    assert policy.query_refusal("library", {"favorite": True}) == "arguments_invalid", "a media type is required"


# ------------------------------------------------------------------------------------------------ media_query_service against a fake Home Assistant


class Verifier:
    def __init__(self, reason: str | None = None) -> None:
        self.reason = reason

    def verify(self, msg: dict[str, Any]) -> str | None:
        return self.reason


class Hass:
    def __init__(self, states: dict[str, tuple[str, dict[str, Any]]], ma_state: str | None = "loaded", responses: dict[str, Any] | None = None, user_active: bool = True) -> None:
        self.calls: list[tuple[str, str, dict[str, Any], Any]] = []
        self.responses = responses or {}
        self._states = states
        entry = SimpleNamespace(entry_id="ma-entry-secret", state=SimpleNamespace(value=ma_state)) if ma_state is not None else None
        self.config_entries = SimpleNamespace(async_entries=lambda domain: [entry] if entry is not None and domain == "music_assistant" else [])
        self.states = SimpleNamespace(get=lambda eid: SimpleNamespace(state=states[eid][0], attributes=states[eid][1]) if eid in states else None)
        user = SimpleNamespace(id="u1", is_active=user_active)

        async def get_user(uid: str):
            return user if uid == "u1" else None

        async def call(domain: str, service: str, data: dict[str, Any], blocking: bool = False, return_response: bool = False, context: Any = None):
            self.calls.append((domain, service, data, context))
            out = self.responses.get(service)
            if isinstance(out, Exception):
                raise out
            if out == "hang":
                await asyncio.sleep(60)
            return out

        self.auth = SimpleNamespace(async_get_user=get_user)
        self.services = SimpleNamespace(async_call=call)


@pytest.fixture(autouse=True)
def fake_ha(monkeypatch):
    monkeypatch.setattr(svc, "_ha", lambda: SimpleNamespace(Context=lambda user_id=None: SimpleNamespace(user_id=user_id), platform_of=lambda hass, eid: PLATFORMS.get(eid) or ("sonos" if eid.startswith("media_player.sonos") else None)))
    svc._calls.clear()
    svc._user_calls.clear()


def ask(hass: Hass, query: str, verifier: Verifier | None = None, **fields: Any) -> dict[str, Any]:
    msg = {"user_id": "u1", "query": query, "request_id": "req-1", "ts": 1, "nonce": "n", "sig": "s", **fields}
    return asyncio.run(svc.async_handle_media_query(hass, verifier or Verifier(), msg))


MA_STATES = {"media_player.ma_a": ("playing", {"supported_features": 1}), "media_player.heos": ("idle", {}), "media_player.gone": ("unavailable", {})}


def test_a_queue_read_calls_get_queue_as_the_callers_user_and_trims_the_answer():
    raw = {"media_player.ma_a": {"items": 12, "current_index": 3, "shuffle_enabled": True, "repeat_mode": "all",
                                 "current_item": {"name": "x" * 300, "media_item": {"artists": [{"name": "אמן"}], "album": {"name": "אלבום"}, "uri": "library://secret/uri", "image": "http://img"}, "duration": 200, "queue_item_id": "q-secret"},
                                 "next_item": {"name": "הבא", "media_item": {"artists": "אמן ב"}, "streamdetails": {"url": "http://stream"}}}}
    hass = Hass({**MA_STATES, "media_player.ma_a": ("playing", {})}, responses={"get_queue": raw})
    out = ask(hass, "queue", entity_id="media_player.ma_a")
    assert out["ok"] is True and (out["request_id"], out["query"], out["provider"]) == ("req-1", "queue", "ma")
    res = out["result"]
    assert (res["count"], res["index"], res["shuffle"], res["repeat"]) == (12, 3, True, "all")
    assert res["current"] == {"name": "x" * 120, "artist": "אמן", "album": "אלבום", "duration": 200} and res["next"]["artist"] == "אמן ב"
    blob = json.dumps(out)
    assert not [w for w in ("secret", "http", "queue_item_id", "stream", "image", "ma-entry") if w in blob], "nothing but names, numbers and flags leaves"
    (domain, service, data, ctx), = hass.calls
    assert (domain, service, data, ctx.user_id) == ("music_assistant", "get_queue", {"entity_id": "media_player.ma_a"}, "u1")


def test_a_library_read_uses_the_loaded_entry_inside_the_bridge_and_drops_what_is_not_an_ma_uri():
    items = [{"uri": "library://playlist/1", "media_type": "playlist", "name": "ערב", "artists": [{"name": "א"}], "image": "http://i", "provider_mappings": [{"x": 1}]},
             {"uri": "https://evil/x", "media_type": "playlist", "name": "bad"}, {"uri": "library://playlist/2", "media_type": "weird", "name": "w"}] + [{"uri": f"library://playlist/{i}", "media_type": "playlist", "name": f"n{i}"} for i in range(3, 140)]
    hass = Hass(MA_STATES, responses={"get_library": {"items": items}})
    out = ask(hass, "library", media_type="playlist", favorite=True, limit=50, offset=0, order_by="name")
    assert out["ok"] and out["provider"] == "ma" and out["result"]["offset"] == 0 and out["result"]["limit"] == 50
    got = out["result"]["items"]
    assert len(got) == 100 and got[0] == {"uri": "library://playlist/1", "media_type": "playlist", "name": "ערב", "artist": "א"}, "at most 100 items, only the four keys"
    assert "https" not in json.dumps(got) and "ma-entry" not in json.dumps(out) and "image" not in json.dumps(got) and "provider_mappings" not in json.dumps(got)
    (domain, service, data, _ctx), = hass.calls
    assert (domain, service) == ("music_assistant", "get_library") and data == {"config_entry_id": "ma-entry-secret", "media_type": "playlist", "favorite": True, "limit": 50, "offset": 0, "order_by": "name"}


def test_every_refusal_is_a_fixed_code_and_asks_nothing():
    hass = Hass(MA_STATES)
    assert ask(hass, "queue", Verifier("bad_signature"), entity_id="media_player.ma_a")["error"] == "bad_signature"
    assert ask(hass, "search", entity_id="media_player.ma_a")["error"] == "query_not_allowed"
    assert ask(hass, "queue", entity_id="light.x")["error"] == "arguments_invalid"
    assert ask(hass, "library", media_type="playlist", config_entry_id="abc")["error"] == "arguments_invalid"
    assert ask(Hass(MA_STATES, user_active=False), "queue", entity_id="media_player.ma_a")["error"] == "unknown_user"
    msg = {"user_id": "nobody", "query": "queue", "request_id": "r", "ts": 1, "nonce": "n", "sig": "s", "entity_id": "media_player.ma_a"}
    assert asyncio.run(svc.async_handle_media_query(hass, Verifier(), msg))["error"] == "unknown_user"
    assert asyncio.run(svc.async_handle_media_query(hass, Verifier(), {**msg, "user_id": 5}))["error"] == "invalid_request"
    assert ask(hass, "queue", entity_id="media_player.nowhere")["error"] == "entity_not_found"
    assert ask(hass, "queue", entity_id="media_player.gone")["error"] == "entity_unavailable"
    assert ask(Hass({"media_player.heos": ("idle", {})}), "queue", entity_id="media_player.heos")["error"] == "no_library", "a vendor player has no music layer here"
    assert hass.calls == []
    assert ask(Hass(MA_STATES, ma_state="not_loaded"), "queue", entity_id="media_player.ma_a")["error"] == "no_library"
    assert ask(Hass(MA_STATES, ma_state=None), "library", media_type="radio")["error"] == "no_library"


def test_a_slow_or_failing_read_answers_with_a_class_name_never_the_text(monkeypatch):
    monkeypatch.setattr(svc, "READ_TIMEOUT_S", 0.05)
    assert ask(Hass(MA_STATES, responses={"get_queue": "hang"}), "queue", entity_id="media_player.ma_a")["error"] == "timeout"
    boom = ask(Hass(MA_STATES, responses={"get_queue": RuntimeError("token=SECRET at the-lab-host")}), "queue", entity_id="media_player.ma_a")
    assert boom == {"ok": False, "request_id": "req-1", "query": "queue", "error": "RuntimeError"} and "SECRET" not in json.dumps(boom)
    assert ask(Hass(MA_STATES, responses={"get_queue": "not a queue"}), "queue", entity_id="media_player.ma_a")["error"] == "bad_answer"


def test_reads_are_rate_limited(monkeypatch):
    monkeypatch.setattr(svc, "RATE_MAX", 3)
    hass = Hass(MA_STATES, responses={"get_queue": {"items": 1}})
    answers = [ask(hass, "queue", entity_id="media_player.ma_a") for _ in range(5)]
    assert [a["ok"] for a in answers] == [True, True, True, False, False] and answers[3]["error"] == "rate_limited"


def test_a_sonos_player_answers_from_its_own_state_and_favourites_are_its_source_list():
    states = {"media_player.sonos_living": ("playing", {"queue_size": 7, "queue_position": 2, "source_list": ["Radio A (תחנת רדיו)", "Evening playlist", "x" * 200]})}
    hass = Hass(states)
    q = ask(hass, "queue", entity_id="media_player.sonos_living")
    assert q["ok"] and q["provider"] == "sonos" and q["result"] == {"count": 7, "index": 2, "current": None, "next": None}
    fav = ask(hass, "library", entity_id="media_player.sonos_living", media_type="track", favorite=True, limit=50, offset=0, order_by="name")
    assert fav["provider"] == "sonos" and [i["name"] for i in fav["result"]["items"]] == ["Radio A (תחנת רדיו)", "Evening playlist"], "an over-long name is not a favourite"
    radio = ask(hass, "library", entity_id="media_player.sonos_living", media_type="radio", limit=50)
    assert [i["name"] for i in radio["result"]["items"]] == ["Radio A (תחנת רדיו)"]
    assert ask(hass, "library", entity_id="media_player.sonos_living", media_type="playlist", limit=50)["result"]["items"] == []
    assert hass.calls == [], "a native Sonos answer asks Home Assistant for no service"
    # a Sonos house works without Music Assistant being loaded at all
    assert ask(Hass(states, ma_state=None), "queue", entity_id="media_player.sonos_living")["ok"] is True


def test_the_service_is_registered_with_response_and_removed_on_unload():
    src = (SRC / "__init__.py").read_text(encoding="utf-8")
    assert "SERVICE_MEDIA_QUERY" in src and "from .media_query_service import async_handle_media_query" in src and "supports_response=SupportsResponse.ONLY" in src
    assert "hass.services.async_remove(DOMAIN, SERVICE_MEDIA_QUERY)" in src


def test_one_user_has_a_share_of_the_global_read_budget(monkeypatch):
    """CR-016 review L3: a reader cannot drain the bridge's whole read budget; a refusal by the share takes no global slot."""
    monkeypatch.setattr(svc, "RATE_MAX", 6)
    monkeypatch.setattr(svc, "RATE_USER_MAX", 2)
    assert [svc._rate_limited(0.0, "u1") for _ in range(4)] == [False, False, True, True]
    assert [svc._rate_limited(0.0, "u2") for _ in range(3)] == [False, False, True]
    assert len(svc._calls) == 4
    assert svc._rate_limited(0.0) is False and svc._rate_limited(0.0) is False and svc._rate_limited(0.0) is True, "the global budget still applies"
    assert svc._rate_limited(61.0, "u1") is False, "the window moves"
