"""CR-036 slice S18: a station's live video and talk in Arx's own drawer (services/intercom_media.py, routers/intercom_media.py).

Fakes only: the WisKey feed is test_intercom's scripted Home Assistant socket, go2rtc is the HTTP mock of test_intercom
(`fake_go2rtc`), the go2rtc media socket is replaced by a scripted relay (as in test_ha_camera_live), and the talk upstream is
the FakeProvider's in-memory channel. Nothing here contacts a station, WisKey, Home Assistant or a real go2rtc."""
from __future__ import annotations

import json
import time
from dataclasses import replace
from typing import Any

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect
from test_intercom import CAM_OVERVIEW, GO2RTC, camera_feed, fake_go2rtc, feed  # noqa: F401 - fixtures

from intercom_station_scope import station_scope  # noqa: F401 - a fixture
from smplwise.main import create_app
from smplwise.routers import media
from smplwise.services import intercom_media as im
from smplwise.services import leases

MEDIA = "/api/v1/access-control/stations/{}/media"
LIVE = "/api/v1/access-control/stations/{}/live/ws?profile={}"
TALK = "/api/v1/access-control/stations/{}/talk"
SECRETS = ("rtsp", "192.0.2", "198.51.100", "p@ss", "door:", "Channels/10", "Basic ")


@pytest.fixture()
def fake_provider():
    p = im.FakeProvider()
    im.set_provider(p)
    yield p
    im.set_provider(None)
    im.MEDIA.reset()


def mode(c: TestClient, value: str) -> None:
    r = c.patch("/api/v1/settings", json={"access.station_media": value})
    assert r.status_code == 200, r.text


def audit_rows(s: Any, action: str) -> list[dict[str, Any]]:
    from smplwise.db import Database

    with Database(s.db_path).connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY rowid", (action,)).fetchall()]


def scripted_relay(frames: list[str], seen: dict[str, Any]):
    async def relay(websocket, upstream_url, headers, on_down, should_stop=None, on_text=None):
        seen["url"] = upstream_url
        seen["sessions"] = [(x.camera_id, x.stream) for x in media.REGISTRY.sessions.values()]
        seen["viewers"] = im.MEDIA.viewers("entry-a")
        for f in frames:
            out = on_text(f) if on_text else f
            if out is not None:
                await websocket.send_text(out)
        return "client_closed"

    return relay


# ---------------------------------------------------------------- the setting

def test_the_setting_is_off_by_default_validated_audited_and_admin_only(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        assert c.get("/api/v1/settings").json()["settings"]["access.station_media"] == "off"
        for bad in ("on", "", "VIDEO", "talk"):
            assert c.patch("/api/v1/settings", json={"access.station_media": bad}).status_code == 422
        for good in ("video", "video_talk", "off"):
            assert c.patch("/api/v1/settings", json={"access.station_media": good}).json()["settings"]["access.station_media"] == good
        bind(c, settings, "ron", "viewer", "installation", "*")
        assert c.patch("/api/v1/settings", json={"access.station_media": "video"}, headers=as_user("ron")).status_code == 403
        assert c.get("/api/v1/settings").json()["settings"]["access.station_media"] == "off"
        rows = [json.loads(r["details_json"] or "{}") for r in audit_rows(settings, "settings.update") if r["decision"] == "allowed"]
        assert {"access.station_media": "video_talk"} in rows


# ---------------------------------------------------------------- the descriptor contract

NOW = 1_800_000_000.0


def raw(**over: Any) -> dict[str, Any]:
    base = {
        "schema": im.SCHEMA, "station_id": "entry-a", "session": "abcdefghijklmnop1234", "revision": 3,
        "issued_at": "2027-01-15T08:00:00Z", "expires_at": "2027-01-15T08:10:00Z",
        "video": {"profiles": [{"id": "sub", "codec": "h264", "transports": ["webrtc", "mse"], "width": 640, "height": 360, "fps": 15}]},
        "audio": {"listen": True, "talk": True, "duplex": "half", "codec": "pcmu", "talk_transports": ["pcmu_frames"], "max_talk_seconds": 90},
        "limits": {"max_viewers": 3, "max_talkers": 4},
    }
    base.update(over)
    return base


def at(iso: str) -> float:
    from datetime import datetime

    return datetime.fromisoformat(iso.replace("Z", "+00:00")).timestamp()


def test_a_valid_descriptor_parses_and_arx_keeps_its_own_limits():
    d = im.parse_descriptor(raw(), station_id="entry-a", provider="test", now=at("2027-01-15T08:01:00Z"))
    assert [p.id for p in d.profiles] == ["sub"] and d.default_profile == "sub"
    assert d.talk and d.talk_transport == "pcmu_frames" and d.max_talk_seconds == 90 and d.duplex == "half"
    assert d.max_viewers == 3 and d.max_talkers == 1, "one talker per station whatever a descriptor says"


@pytest.mark.parametrize("change, code", [
    ({"schema": "wiskey.v0"}, "descriptor_schema_unknown"),
    ({"station_id": "entry-b"}, "descriptor_station_mismatch"),
    ({"session": "short"}, "descriptor_session_invalid"),
    ({"session": "has space in it here!!"}, "descriptor_session_invalid"),
    ({"expires_at": "2027-01-15T08:00:30Z"}, "descriptor_expired"),
    ({"expires_at": "2027-01-17T08:00:00Z"}, "descriptor_lifetime_too_long"),
    ({"expires_at": "2027-01-15T08:10:00"}, "descriptor_expires_at_invalid"),
    ({"video": {"profiles": [{"id": "sub", "transports": ["webrtc"], "stream": "rtsp://u:p@station/Streaming/Channels/102"}]}}, "descriptor_carries_address"),
    ({"video": {"profiles": [{"id": "sub", "transports": ["webrtc"], "label": "192.0.2.44"}]}}, "descriptor_carries_address"),
    ({"video": {"profiles": [{"id": "sub", "transports": ["webrtc"], "label": "fe80::1"}]}}, "descriptor_carries_address"),
    ({"audio": {"talk": True, "token": "0123456789abcdef"}}, "descriptor_carries_secret"),
    ({"source_url": "x"}, "descriptor_carries_secret"),
    ({"limits": {"max_viewers": 1, "host": "door-station.lan"}}, "descriptor_carries_secret"),
    ([], "descriptor_not_an_object"),
])
def test_a_descriptor_that_could_leak_or_overgrant_is_refused(change, code):
    r = change if isinstance(change, list) else raw(**change)
    with pytest.raises(im.DescriptorError) as e:
        im.parse_descriptor(r, station_id="entry-a", provider="test", now=at("2027-01-15T08:01:00Z"))
    assert e.value.code == code
    assert "192.0.2" not in str(e.value) and "rtsp" not in str(e.value), "the code names the rule, never the value"


def test_unknown_profiles_transports_and_codecs_are_dropped_not_guessed():
    d = im.parse_descriptor(raw(
        video={"profiles": [{"id": "ultra", "transports": ["webrtc"]}, {"id": "main", "codec": "av1", "transports": ["hls", "mse"]},
                            {"id": "sub", "transports": ["hls"]}, {"id": "main", "transports": ["webrtc"]}]},
        audio={"talk": True, "duplex": "half", "codec": "opus", "talk_transports": ["webrtc", "sip"], "max_talk_seconds": 99999},
        limits={"max_viewers": 500},
    ), station_id="entry-a", provider="test", now=at("2027-01-15T08:01:00Z"))
    assert [(p.id, p.codec, p.transports) for p in d.profiles] == [("main", "unknown", ("mse",))]
    assert d.default_profile == "main"
    assert d.talk and d.talk_transport is None, "webrtc talk is in the contract, not in this build; opus is no frame codec"
    assert d.max_talk_seconds == im.MAX_TALK_S and d.max_viewers == im.MAX_VIEWERS_CAP
    no_duplex = im.parse_descriptor(raw(audio={"talk": True, "codec": "pcmu", "talk_transports": ["pcmu_frames"]}), station_id="entry-a", provider="t", now=at("2027-01-15T08:01:00Z"))
    assert not no_duplex.talk, "talk without a duplex statement is no talk"


def test_the_fake_provider_is_refused_inside_the_add_on(settings, monkeypatch):
    monkeypatch.setenv(im.FAKE_ENV, "1")
    im.set_provider(None)
    assert im.provider_for(replace(settings, in_addon=False)).name == "fake"
    assert im.provider_for(replace(settings, in_addon=True)).name == "local"
    monkeypatch.delenv(im.FAKE_ENV)
    assert im.provider_for(settings).name == "local"


# ---------------------------------------------------------------- what the drawer may offer

def test_off_by_default_the_drawer_keeps_the_still_and_the_classic_panel(feed, fake_go2rtc, fake_provider):
    c, s = camera_feed(feed)
    r = c.get(MEDIA.format("entry-a"))
    assert r.status_code == 200, r.text
    assert r.json() | {} == {"station_id": "entry-a", "mode": "off", "state": "off", "reason": None, "video": None, "talk": None, "listen": False, "expires_at": None}
    assert fake_provider.described == 0, "nothing is asked of the provider while the setting is off"


def test_ready_offers_profiles_paths_and_talk_and_serves_no_source(feed, fake_go2rtc, fake_provider):
    c, s = camera_feed(feed)
    mode(c, "video_talk")
    body = c.get(MEDIA.format("entry-a")).json()
    assert body["state"] == "ready" and body["mode"] == "video_talk" and body["listen"] is True
    v = body["video"]
    assert [p["id"] for p in v["profiles"]] == ["sub", "main"] and v["default_profile"] == "sub" and v["allowed"] is True
    assert v["paths"] == {"sub": "api/v1/access-control/stations/entry-a/live/ws?profile=sub", "main": "api/v1/access-control/stations/entry-a/live/ws?profile=main"}
    assert body["talk"] == {"available": True, "reason": None, "transport": "pcmu_frames", "codec": "pcmu", "duplex": "half", "max_seconds": 120,
                            "sample_rate": 8000, "frame_ms": 20, "busy": False}
    text = json.dumps(body)
    assert not any(x in text for x in SECRETS) and "fake-" not in text, "no source, no address, no descriptor handle"
    mode(c, "video")
    assert c.get(MEDIA.format("entry-a")).json()["talk"] == {"available": False, "reason": "off"}
    fake_provider.talk = False
    im.MEDIA.reset()
    mode(c, "video_talk")
    assert c.get(MEDIA.format("entry-a")).json()["talk"] == {"available": False, "reason": "unsupported"}


def test_who_sees_what(feed, fake_go2rtc, fake_provider, station_scope):  # noqa: F811
    c, s = camera_feed(feed)
    mode(c, "video_talk")
    bind(c, s, "vera", "viewer", "installation", "*")  # access.read + video.live, no access.call
    body = c.get(MEDIA.format("entry-a"), headers=as_user("vera")).json()
    assert body["video"]["allowed"] is True and body["talk"] == {"available": False, "reason": "forbidden"}
    station_scope.bind("dev-sam", "viewer", "entry-b")  # sees entry-b only
    assert c.get(MEDIA.format("entry-a"), headers=as_user("sam")).status_code == 404
    assert c.get(MEDIA.format("nope")).status_code == 404
    assert c.get(MEDIA.format("entry-a"), headers=as_user("nobody")).status_code == 403


def test_unavailable_states_name_their_reason(feed, fake_go2rtc):
    """Arx's own source (the production provider until W10): video only, main profile; the reasons of the stills."""
    im.set_provider(None)
    im.MEDIA.reset()
    c, s = camera_feed(feed)
    mode(c, "video_talk")
    body = c.get(MEDIA.format("entry-a")).json()
    assert body["state"] == "ready" and [p["id"] for p in body["video"]["profiles"]] == ["main"] and body["video"]["default_profile"] == "main"
    assert body["talk"] == {"available": False, "reason": "unsupported"}, "no talk without an intercom hook: the classic panel keeps it"
    for sid, reason in (("entry-b", "offline"), ("entry-c", "no_host"), ("entry-e", "no_camera")):
        r = c.get(MEDIA.format(sid)).json()
        assert (r["state"], r["reason"]) == ("unavailable", reason), sid
    c2 = TestClient(create_app(replace(s, wiskey_password=None)))
    assert c2.get(MEDIA.format("entry-a")).json()["reason"] == "no_credentials"
    im.MEDIA.reset()
    c3 = TestClient(create_app(replace(s, go2rtc_url=None)))
    assert c3.get(MEDIA.format("entry-a")).json()["reason"] == "no_media"


# ---------------------------------------------------------------- live video through the existing relay

def test_live_video_rides_the_existing_relay_budget_and_audit(feed, fake_go2rtc, fake_provider, monkeypatch):
    c, s = camera_feed(feed)
    mode(c, "video")
    seen: dict[str, Any] = {}
    monkeypatch.setattr(media, "relay_ws", scripted_relay(['{"type":"webrtc/answer","value":"v=0"}', '{"type":"error","value":"rtsp://door:p@192.0.2.10 refused"}'], seen))
    with c.websocket_connect(LIVE.format("entry-a", "sub")) as ws:
        assert json.loads(ws.receive_text())["type"] == "webrtc/answer"
        assert json.loads(ws.receive_text()) == {"type": "error", "value": "upstream_error"}, "go2rtc's error text never reaches the viewer"
    assert seen["url"] == f"{GO2RTC.replace('http', 'ws')}/api/ws?src=smplwise_wiskey_entry-a.sub"
    assert seen["sessions"] == [("entry-a", "smplwise_wiskey_entry-a.sub")] and seen["viewers"] == 1
    assert media.REGISTRY.count() == 0 and im.MEDIA.viewers("entry-a") == 0
    start, stop = audit_rows(s, "video.live.start"), audit_rows(s, "video.live.stop")
    assert start[-1]["resource_type"] == "intercom_station" and start[-1]["resource_id"] == "entry-a" and stop
    assert not any(x in json.dumps(start + stop) for x in SECRETS)


def _closed_with(c: TestClient, path: str, headers: dict[str, str] | None = None) -> int:
    with pytest.raises(WebSocketDisconnect) as e:
        with c.websocket_connect(path, headers=headers or {}) as ws:
            ws.receive_text()
    return e.value.code


def test_live_video_refusals(feed, fake_go2rtc, fake_provider, monkeypatch):
    c, s = camera_feed(feed)
    monkeypatch.setattr(media, "relay_ws", scripted_relay([], {}))
    assert _closed_with(c, LIVE.format("entry-a", "sub")) == 4403, "the setting is off"
    mode(c, "video")
    assert _closed_with(c, LIVE.format("entry-b", "sub")) == 4503, "offline"
    assert _closed_with(c, LIVE.format("nope", "sub")) == 4403
    fake_provider.max_viewers = 1
    im.MEDIA.reset()
    im.MEDIA.add_viewer("entry-a", "someone-else", 1)
    assert _closed_with(c, LIVE.format("entry-a", "sub")) == 4429, "the station's own viewer limit"
    im.MEDIA.drop_viewer("entry-a", "someone-else")
    monkeypatch.setattr(im, "_override", None)
    im.MEDIA.reset()
    assert _closed_with(c, LIVE.format("entry-a", "sub")) == 4403, "Arx's own source has the main profile only"


def test_live_video_follows_the_station_chain(feed, fake_go2rtc, fake_provider, monkeypatch, station_scope):  # noqa: F811
    """`access.read` and `video.live` on the station chain: an operator bound to one station watches that station only; a
    deny on the station closes it for an installation-wide viewer."""
    c, s = camera_feed(feed)
    mode(c, "video")
    seen: dict[str, Any] = {}
    monkeypatch.setattr(media, "relay_ws", scripted_relay(['{"type":"mse","value":"video/mp4"}'], seen))
    station_scope.bind("dev-otto", "operator", "entry-a")
    body = c.get(MEDIA.format("entry-a"), headers=as_user("otto")).json()
    assert body["video"]["allowed"] is True and set(body["video"]["paths"]) == {"sub", "main"}
    with c.websocket_connect(LIVE.format("entry-a", "sub"), headers=as_user("otto")) as ws:
        assert json.loads(ws.receive_text())["type"] == "mse"
    assert _closed_with(c, LIVE.format("entry-d", "sub"), as_user("otto")) == 4403, "a station off their chain"
    bind(c, s, "vera", "viewer", "installation", "*")
    station_scope.bind("dev-vera", "viewer", "entry-a", effect="deny")
    assert _closed_with(c, LIVE.format("entry-a", "sub"), as_user("vera")) == 4403
    assert c.get(MEDIA.format("entry-a"), headers=as_user("vera")).status_code == 404


def test_a_lost_permission_ends_the_live_view(feed, fake_go2rtc, fake_provider, monkeypatch):
    c, s = camera_feed(feed)
    mode(c, "video")
    lease_box: dict[str, Any] = {}

    async def relay(websocket, upstream_url, headers, on_down, should_stop=None, on_text=None):
        lease_box["stop"] = should_stop
        return "client_closed"

    monkeypatch.setattr(media, "relay_ws", relay)
    with c.websocket_connect(LIVE.format("entry-a", "main")):
        pass
    lease = lease_box["stop"].__self__  # the relay's should_stop is the StationLease's own
    assert lease.allowed_now() is True
    mode(c, "off")
    assert lease.allowed_now() is False, "the setting turned off ends every live view"
    mode(c, "video")
    fake_provider.unavailable["entry-a"] = "no_camera"
    im.MEDIA.reset()
    assert lease.allowed_now() is False, "a descriptor that no longer offers video ends it too"


# ---------------------------------------------------------------- talk

def start(c: TestClient, sid: str = "entry-a", headers: dict[str, str] | None = None, **body: Any):
    return c.post(TALK.format(sid), json=body or None, headers=headers or {})


def test_a_talk_session_end_to_end_audited_without_audio(feed, fake_go2rtc, fake_provider):
    c, s = camera_feed(feed)
    mode(c, "video_talk")
    r = start(c, client_request_id="ptt-0001-abcd")
    assert r.status_code == 200, r.text
    t = r.json()
    assert t["transport"] == "pcmu_frames" and t["codec"] == "pcmu" and t["duplex"] == "half" and t["sample_rate"] == 8000 and t["frame_ms"] == 20
    assert t["ws_path"] == f"api/v1/access-control/talk/{t['session']}/ws" and t["max_seconds"] == 120
    assert c.get(MEDIA.format("entry-a")).json()["talk"]["busy"] is True
    frame = bytes([0x7F, 0xFF, 0x00]) * 53 + b"\x55"  # 160 bytes: 20 ms of mu-law
    with c.websocket_connect(f"/{t['ws_path']}") as ws:
        assert json.loads(ws.receive_text())["value"] == "open"
        ws.send_bytes(frame)  # before the button is held: dropped
        ws.send_text(json.dumps({"type": "talk/ptt", "value": "down"}))
        assert json.loads(ws.receive_text()) == {"type": "talk/floor", "value": "held"}
        for _ in range(3):
            ws.send_bytes(frame)
        ws.send_bytes(b"\x00" * (im.FRAME_MAX_BYTES + 1))  # not a frame
        ws.send_text(json.dumps({"type": "talk/ptt", "value": "up"}))
        assert json.loads(ws.receive_text()) == {"type": "talk/floor", "value": "released"}
        ws.send_bytes(frame)  # released: dropped
        ws.send_text(json.dumps({"type": "talk/stop"}))
        assert json.loads(ws.receive_text()) == {"type": "talk/closed", "value": "stopped"}
    log = fake_provider.talk_log
    assert (log.opened, log.frames, log.bytes, log.floors, log.closed) == (1, 3, 480, [True, False], ["stopped"])
    assert log.actors == [("entry-a", "dev-joni", "ptt-0001-abcd")], "the upstream learns the real actor and the request id"
    [begin] = audit_rows(s, "intercom.talk.start")
    [end] = audit_rows(s, "intercom.talk.end")
    assert begin["resource_type"] == end["resource_type"] == "intercom_station" and begin["resource_id"] == end["resource_id"] == "entry-a"
    assert begin["actor_user_id"] == end["actor_user_id"] == "dev-joni" and begin["request_id"] == end["request_id"] == "ptt-0001-abcd"
    details = json.loads(end["details_json"])
    assert details["outcome"] == "stopped" and details["frames"] == 3 and details["presses"] == 1 and details["duration_s"] >= 0
    assert details["session"] != t["session"] and t["session"] not in json.dumps(begin) + json.dumps(end), "the handle itself is never kept"
    assert set(details) == {"session", "outcome", "duration_s", "frames", "presses", "transport"}, "counts only - never audio content"
    assert set(json.loads(begin["details_json"])) == {"session", "transport", "codec", "duplex", "max_seconds"}
    assert c.get(MEDIA.format("entry-a")).json()["talk"]["busy"] is False


def test_one_talker_per_station_and_one_session_per_user(feed, fake_go2rtc, fake_provider):
    c, s = camera_feed(feed)
    mode(c, "video_talk")
    bind(c, s, "sara", "site_admin", "installation", "*")
    first = start(c)
    assert first.status_code == 200
    busy = start(c, headers=as_user("sara"))
    assert busy.status_code == 409 and busy.json()["code"] == "intercom_talk_busy"
    assert "joni" not in busy.text, "who talks is never said"
    feed_station_d = dict(CAM_OVERVIEW["stations"][3])  # another online station with a camera
    assert feed_station_d["id"] == "entry-d"
    again = start(c, "entry-d")
    assert again.status_code == 409 and again.json()["code"] == "intercom_talk_user_busy"
    assert [r["reason"] for r in audit_rows(s, "intercom.talk.start") if r["decision"] == "denied"] == ["intercom_talk_busy", "intercom_talk_user_busy"]
    assert c.post(f"/api/v1/access-control/talk/{first.json()['session']}/stop", headers=as_user("sara")).status_code == 404, "only its owner stops it"
    assert c.post(f"/api/v1/access-control/talk/{first.json()['session']}/stop").json() == {"stopped": True}
    assert json.loads(audit_rows(s, "intercom.talk.end")[-1]["details_json"])["outcome"] == "stopped"
    assert start(c, headers=as_user("sara")).status_code == 200


def test_talk_refusals_each_leave_one_row(feed, fake_go2rtc, fake_provider):
    c, s = camera_feed(feed)
    r = start(c)
    assert (r.status_code, r.json()["code"]) == (409, "intercom_talk_off")
    mode(c, "video_talk")
    assert (start(c, "entry-b").status_code, start(c, "entry-b").json()["code"]) == (409, "intercom_station_offline")
    assert start(c, "nope").status_code == 404
    bind(c, s, "vera", "viewer", "installation", "*")
    assert start(c, headers=as_user("vera")).status_code == 403, "talk needs access.call (the call permission covers it)"
    assert c.post(TALK.format("entry-a"), content=b"{not json", headers={"content-type": "application/json"}).status_code == 422
    assert start(c, client_request_id="x").status_code == 422
    assert start(c, unexpected=True).status_code == 422
    fake_provider.talk = False
    im.MEDIA.reset()
    assert start(c).json()["code"] == "intercom_talk_unsupported"
    fake_provider.unavailable["entry-a"] = "no_camera"
    im.MEDIA.reset()
    r = start(c)
    assert r.json()["code"] == "intercom_talk_unavailable" and r.json()["details"]["reason"] == "no_camera"
    assert not audit_rows(s, "intercom.talk.end")


def test_a_talk_session_expires(feed, fake_go2rtc, fake_provider):
    c, s = camera_feed(feed)
    mode(c, "video_talk")
    t = start(c).json()
    im.MEDIA.talk(t["session"]).expires_at = time.time() + 1.2
    with pytest.raises(WebSocketDisconnect) as e:
        with c.websocket_connect(f"/{t['ws_path']}") as ws:
            assert json.loads(ws.receive_text())["value"] == "open"
            assert json.loads(ws.receive_text()) == {"type": "talk/closed", "value": "expired"}
            ws.receive_text()
    assert e.value.code == 4408
    assert json.loads(audit_rows(s, "intercom.talk.end")[-1]["details_json"])["outcome"] == "expired"


def test_a_reservation_never_attached_is_released_and_audited(feed, fake_go2rtc, fake_provider, monkeypatch):
    c, s = camera_feed(feed)
    mode(c, "video_talk")
    first = start(c).json()
    monkeypatch.setattr(im, "RESERVE_S", 0.0)
    time.sleep(0.01)
    assert start(c).status_code == 200, "the stale reservation was released"
    end = audit_rows(s, "intercom.talk.end")[-1]
    assert json.loads(end["details_json"])["outcome"] == "never_connected" and end["actor_user_id"] == "dev-joni"
    assert _closed_with(c, f"/{first['ws_path']}") == 4404


def test_the_socket_belongs_to_the_session_owner_once(feed, fake_go2rtc, fake_provider):
    c, s = camera_feed(feed)
    mode(c, "video_talk")
    bind(c, s, "sara", "site_admin", "installation", "*")
    t = start(c).json()
    assert _closed_with(c, f"/{t['ws_path']}", as_user("sara")) == 4404
    assert _closed_with(c, "/api/v1/access-control/talk/not-a-session-at-all/ws") == 4404
    with c.websocket_connect(f"/{t['ws_path']}") as ws:
        assert json.loads(ws.receive_text())["value"] == "open"
        assert _closed_with(c, f"/{t['ws_path']}") == 4409, "a second socket for one session"
        ws.send_text(json.dumps({"type": "talk/stop"}))
        ws.receive_text()


def test_an_upstream_that_does_not_open_ends_the_session_honestly(feed, fake_go2rtc, fake_provider):
    c, s = camera_feed(feed)
    mode(c, "video_talk")
    fake_provider.fail_open = True
    t = start(c).json()
    with pytest.raises(WebSocketDisconnect) as e:
        with c.websocket_connect(f"/{t['ws_path']}") as ws:
            assert json.loads(ws.receive_text()) == {"type": "talk/closed", "value": "upstream_unavailable"}
            ws.receive_text()
    assert e.value.code == 4503
    details = json.loads(audit_rows(s, "intercom.talk.end")[-1]["details_json"])
    assert details["outcome"] == "upstream_unavailable" and details["duration_s"] == 0


def test_an_upstream_that_closes_ends_the_session(feed, fake_go2rtc, fake_provider):
    c, s = camera_feed(feed)
    mode(c, "video_talk")
    fake_provider.drop_after_frames = 2
    t = start(c).json()
    with c.websocket_connect(f"/{t['ws_path']}") as ws:
        ws.receive_text()
        ws.send_text(json.dumps({"type": "talk/ptt", "value": "down"}))
        ws.receive_text()
        ws.send_bytes(b"\xff" * 160)
        ws.send_bytes(b"\xff" * 160)
        assert json.loads(ws.receive_text()) == {"type": "talk/closed", "value": "upstream_closed"}
    assert json.loads(audit_rows(s, "intercom.talk.end")[-1]["details_json"])["outcome"] == "upstream_closed"


def test_turning_the_setting_off_ends_an_open_talk(feed, fake_go2rtc, fake_provider, monkeypatch):
    c, s = camera_feed(feed)
    mode(c, "video_talk")
    monkeypatch.setattr(leases, "RECHECK_S", 0.0)
    t = start(c).json()
    with c.websocket_connect(f"/{t['ws_path']}") as ws:
        ws.receive_text()
        mode(c, "video")
        assert json.loads(ws.receive_text()) == {"type": "talk/closed", "value": "access_lost"}
    assert json.loads(audit_rows(s, "intercom.talk.end")[-1]["details_json"])["outcome"] == "access_lost"
