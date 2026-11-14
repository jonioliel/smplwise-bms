"""CR-028 phase 1, bridge 0.7.0: `smplwise_bridge.cast_stream` and its independent policy (custom_components/smplwise_bridge/cast_policy.py,
cast_service.py), run without Home Assistant. Addresses are documentation / private examples; nothing is cast anywhere."""
from __future__ import annotations

import asyncio
import json
from types import SimpleNamespace

import bridge_loader
import pytest

policy = bridge_loader.load("cast_policy")
service = bridge_loader.load("cast_service")
signing = bridge_loader.load("signing")
media_policy = bridge_loader.load("media_policy")

SECRET = "pairing-secret-for-tests"
ORIGIN = "http://192.168.50.10:18092"
LOCAL = ["192.168.50.10", "172.30.32.1", "fe80::1"]
URL = f"{ORIGIN}/cast/{'a' * 32}/index.m3u8"
PLATFORMS = {"media_player.tv_cast": "cast", "media_player.tv_dlna": "dlna_dmr", "media_player.tv_apple": "apple_tv"}


def platform_of(entity_id):
    return PLATFORMS.get(entity_id)


def msg(op="play", **over):
    body = {"user_id": "u1", "op": op, "entity_id": "media_player.tv_cast", "request_id": "r1"}
    if op == "play":
        body["url"] = URL
    body.update(over)
    return signing.sign(SECRET, {k: v for k, v in body.items() if v is not None})


# ------------------------------------------------------------------------------------------------ the pure policy

def test_a_relay_url_on_the_announced_local_origin_plays():
    assert policy.refusal(msg(), platform_of, ORIGIN, LOCAL) is None
    assert policy.refusal(msg(title="שער ראשי"), platform_of, ORIGIN, LOCAL) is None
    domain, svc, data = policy.service_call(msg(title="שער"))
    assert (domain, svc) == ("media_player", "play_media")
    assert data == {"entity_id": "media_player.tv_cast", "media_content_type": "application/vnd.apple.mpegurl", "media_content_id": URL,
                    "extra": {"stream_type": "LIVE", "title": "שער"}}
    assert policy.service_call(msg("stop"))[:2] == ("media_player", "media_stop")
    assert policy.service_call(msg("off"))[:2] == ("media_player", "turn_off")


@pytest.mark.parametrize("url,code", [
    ("http://192.168.50.10:18093/cast/" + "a" * 32 + "/index.m3u8", "cast_origin_mismatch"),        # another port
    ("http://192.168.50.11:18092/cast/" + "a" * 32 + "/index.m3u8", "cast_origin_mismatch"),        # another host on the LAN
    ("https://192.168.50.10:18092/cast/" + "a" * 32 + "/index.m3u8", "cast_url_refused"),           # scheme
    ("http://u:p@192.168.50.10:18092/cast/" + "a" * 32 + "/index.m3u8", "cast_url_refused"),        # credentials
    ("http://192.168.50.10:18092/cast/" + "a" * 32 + "/index.m3u8?src=intercom", "cast_url_refused"),
    ("http://192.168.50.10:18092/cast/" + "a" * 32 + "/index.m3u8#x", "cast_url_refused"),
    ("http://192.168.50.10:18092/api/stream.m3u8", "cast_url_refused"),                             # go2rtc's own path
    ("http://192.168.50.10:18092/cast/" + "A" * 32 + "/index.m3u8", "cast_url_refused"),
    ("http://192.168.50.10:18092/cast/" + "a" * 31 + "/index.m3u8", "cast_url_refused"),
    ("http://192.168.50.10:18092/cast/" + "a" * 32 + "/../index.m3u8", "cast_url_refused"),
    ("http://homeassistant.local:18092/cast/" + "a" * 32 + "/index.m3u8", "cast_url_refused"),       # a name, never resolved here
    ("http://192.168.50.10/cast/" + "a" * 32 + "/index.m3u8", "cast_url_refused"),                  # no explicit port
    ("https://www.youtube.com/watch?v=x", "cast_url_refused"),
    (12, "cast_url_refused"),
])
def test_every_other_url_is_refused(url, code):
    m = msg()
    m = signing.sign(SECRET, {**{k: v for k, v in m.items() if k not in ("ts", "nonce", "sig")}, "url": url})
    assert policy.refusal(m, platform_of, ORIGIN, LOCAL) == code


def test_the_origin_must_be_announced_and_an_address_of_this_host():
    assert policy.refusal(msg(), platform_of, None, LOCAL) == "cast_origin_unknown"
    assert policy.refusal(msg(), platform_of, "http://homeassistant.local:18092", LOCAL) == "cast_origin_unknown"
    assert policy.refusal(msg(), platform_of, ORIGIN, None) == "cast_origin_unverifiable"
    assert policy.refusal(msg(), platform_of, ORIGIN, ["192.168.50.99"]) == "cast_origin_not_local"


@pytest.mark.parametrize("entity", ["media_player.tv_dlna", "media_player.tv_apple", "media_player.unknown", "remote.tv_cast", "media_player.TV"])
def test_only_a_cast_media_player_is_a_target(entity):
    assert policy.refusal(msg(entity_id=entity), platform_of, ORIGIN, LOCAL) == "cast_entity"
    assert policy.refusal(msg("stop", entity_id=entity), platform_of, ORIGIN, LOCAL) == "cast_entity"


def test_ops_and_keys_are_closed():
    assert policy.refusal(msg("seek"), platform_of, ORIGIN, LOCAL) == "cast_op_refused"
    assert policy.refusal(msg("stop", url=URL), platform_of, ORIGIN, LOCAL) == "invalid_request"
    assert policy.refusal(msg(extra="x"), platform_of, ORIGIN, LOCAL) == "invalid_request"
    assert policy.refusal(msg(title="x" * 81), platform_of, ORIGIN, LOCAL) == "invalid_request"
    assert policy.refusal(msg(title="a\nb"), platform_of, ORIGIN, LOCAL) == "invalid_request"
    no_url = {k: v for k, v in msg().items() if k != "url"}
    assert policy.refusal(no_url, platform_of, ORIGIN, LOCAL) == "invalid_request"


def test_the_generic_execute_path_still_refuses_every_play_media_url():
    """CR-015 is unchanged: the URL path exists only through cast_stream."""
    for kind in ("application/vnd.apple.mpegurl", "video/mp4", "url", "music"):
        data = {"entity_id": "media_player.tv_cast", "media_content_type": kind, "media_content_id": URL}
        assert media_policy.refusal("media_player", "play_media", data, lambda e: {}, platform_of) == "media_play_media_type"


# ------------------------------------------------------------------------------------------------ the service handler

class Hass:
    def __init__(self, active=True):
        self.auth = SimpleNamespace(async_get_user=self._user)
        self.active = active

    async def _user(self, user_id):
        return SimpleNamespace(id=user_id, is_active=self.active, is_admin=False) if user_id == "u1" else None


@pytest.fixture()
def bridge(monkeypatch):
    service.STATE.update(origin=None, origin_at=None)
    service._calls.clear()

    async def addresses(_hass):
        return list(LOCAL)

    monkeypatch.setattr(service, "_local_addresses", addresses)
    calls = []

    async def call(domain, svc, data, context):
        calls.append((domain, svc, data))

    verifier = signing.Verifier(SECRET)
    return verifier, calls, call


def run(coro):
    return asyncio.run(coro)


def announce(verifier, origin=ORIGIN):
    service.note_origin(verifier, signing.sign(SECRET, {"purpose": "cast_origin", "cast_origin": origin}))


def test_the_handler_plays_only_after_the_signed_origin_arrived(bridge):
    verifier, calls, call = bridge
    out = run(service.async_handle_cast_stream(Hass(), verifier, msg(), platform_of, call))
    assert out == {"ok": False, "request_id": "r1", "error": "cast_origin_unknown"} and calls == []
    announce(verifier)
    out = run(service.async_handle_cast_stream(Hass(), verifier, msg(), platform_of, call))
    assert out["ok"] is True and calls[0][:2] == ("media_player", "play_media") and calls[0][2]["media_content_id"] == URL


def test_a_forged_or_replayed_or_misdirected_origin_block_is_ignored(bridge):
    verifier, calls, call = bridge
    service.note_origin(verifier, signing.sign("another-secret", {"purpose": "cast_origin", "cast_origin": ORIGIN}))
    assert service.STATE["origin"] is None
    service.note_origin(verifier, signing.sign(SECRET, {"purpose": "something_else", "cast_origin": ORIGIN}))
    assert service.STATE["origin"] is None
    service.note_origin(verifier, signing.sign(SECRET, {"purpose": "cast_origin", "cast_origin": ORIGIN, "extra": 1}))
    assert service.STATE["origin"] is None
    block = signing.sign(SECRET, {"purpose": "cast_origin", "cast_origin": ORIGIN})
    service.note_origin(verifier, block)
    assert service.STATE["origin"] == ORIGIN
    service.note_origin(verifier, signing.sign(SECRET, {"purpose": "cast_origin", "cast_origin": None}))
    assert service.STATE["origin"] is None, "casting switched off in the add-on: the next answer clears it"
    service.note_origin(verifier, block)  # the same block again: a replay
    assert service.STATE["origin"] is None


def test_the_handler_refuses_a_bad_signature_an_unknown_user_and_a_storm(bridge):
    verifier, calls, call = bridge
    announce(verifier)
    forged = {**msg(), "sig": "0" * 64}
    assert run(service.async_handle_cast_stream(Hass(), verifier, forged, platform_of, call))["error"] == "bad_signature"
    assert run(service.async_handle_cast_stream(Hass(), verifier, msg(user_id="nobody"), platform_of, call))["error"] == "unknown_user"
    assert run(service.async_handle_cast_stream(Hass(active=False), verifier, msg(), platform_of, call))["error"] == "unknown_user"
    m = msg("stop")
    assert run(service.async_handle_cast_stream(Hass(), verifier, m, platform_of, call))["ok"] is True
    assert run(service.async_handle_cast_stream(Hass(), verifier, m, platform_of, call))["error"] == "replay"
    for _ in range(service.RATE_MAX):
        run(service.async_handle_cast_stream(Hass(), verifier, msg("stop"), platform_of, call))
    assert run(service.async_handle_cast_stream(Hass(), verifier, msg("stop"), platform_of, call))["error"] == "rate_limited"
    assert all(c[1] in ("media_stop", "play_media") for c in calls)


def test_an_exception_answers_its_class_name_never_its_text(bridge):
    verifier, _calls, _call = bridge
    announce(verifier)

    async def boom(domain, svc, data, context):
        raise RuntimeError(f"cannot reach {URL}")

    out = run(service.async_handle_cast_stream(Hass(), verifier, msg(), platform_of, boom))
    assert out == {"ok": False, "request_id": "r1", "error": "RuntimeError"} and URL not in json.dumps(out)


def test_the_integration_registers_the_service_with_a_closed_schema_and_both_copies_match():
    src = (bridge_loader.SRC / "__init__.py").read_text(encoding="utf-8")
    assert "SERVICE_CAST_STREAM, cast_stream, schema=CAST_STREAM_SCHEMA" in src and "extra=vol.PREVENT_EXTRA" in src.split("CAST_STREAM_SCHEMA = ", 1)[1].split(")\n", 1)[0] + ")"
    assert "note_origin(verifier" in src
    for name in ("cast_policy.py", "cast_service.py", "__init__.py", "const.py", "manifest.json", "services.yaml"):
        assert (bridge_loader.SRC / name).read_bytes() == (bridge_loader.MIRROR / name).read_bytes(), name
    assert "cast_stream:" in (bridge_loader.SRC / "services.yaml").read_text(encoding="utf-8")
