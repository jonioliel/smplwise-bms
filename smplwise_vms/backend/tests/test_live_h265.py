"""LIVE-H265-2341: live video of an H.265 camera in a browser that cannot decode H.265 (services/live_codec.py,
routers/media.py live_ws). No device and no real go2rtc: the go2rtc client and the relay are stand-ins."""
from __future__ import annotations

import json
from dataclasses import replace

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from smplwise.main import create_app
from smplwise.services import go2rtc as g2
from smplwise.services import live_codec as lc

# ---------------------------------------------------------------- codec mapping


@pytest.mark.parametrize("enc, fam", [
    ({"codec": "H.264"}, "h264"),
    ({"codec": "H.265"}, "h265"),
    ({"codec": None, "codec_raw": "H.265+"}, "h265"),
    ({"codec_raw": "SmartH265"}, "h265"),
    ({"codec": "HEVC"}, "h265"),
    ({"codec": "h264+"}, "h264"),
    ({"codec": "MJPEG"}, "mjpeg"),
    ({"codec": "MPEG4"}, "other"),
    ({"codec": None, "reason": "h265"}, "h265"),
    ({"codec": None}, None),
    (None, None),
])
def test_codec_family(enc, fam):
    assert lc.codec_family(enc) == fam


def test_registry_codecs_from_the_camera_row():
    row = {"capabilities_json": json.dumps({"encoding": {"main": {"codec": "H.265"}, "sub": {"codec": "H.264"}}})}
    assert lc.registry_codecs(row) == {"main": "h265", "sub": "h264"}
    assert lc.registry_codecs({"capabilities_json": None}) == {"main": None, "sub": None}
    assert lc.registry_codecs({"capabilities_json": "not json"}) == {"main": None, "sub": None}
    assert lc.merge_observed({"main": "h264", "sub": None}, {"main": "h265", "sub": None}) == {"main": "h265", "sub": None}


def test_go2rtc_producer_codec():
    assert g2.producer_video_codec([{"url": "rtsp://x", "receivers": [{"codec": {"codec_name": "hevc", "codec_type": "video"}}]}]) == "h265"
    assert g2.producer_video_codec([{"medias": ["audio, recvonly, PCMA/8000", "video, recvonly, H265"]}]) == "h265"
    assert g2.producer_video_codec([{"medias": ["video, recvonly, H264"]}]) == "h264"
    assert g2.producer_video_codec([{"receivers": [{"codec": {"codec_name": "pcma", "codec_type": "audio"}}], "medias": ["video, recvonly, H264"]}]) == "h264"
    assert g2.producer_video_codec([{"url": "rtsp://x"}]) is None  # not connected yet: go2rtc does not know
    assert g2.producer_video_codec(["junk", None]) is None


# ---------------------------------------------------------------- fallback selection

H265_MAIN = {"main": "h265", "sub": "h264"}
H265_BOTH = {"main": "h265", "sub": "h265"}


def test_choose_auto_order():
    # (a) the other profile when it is H.264
    c = lc.choose("auto", "main", H265_MAIN, False)
    assert (c.kind, c.profile, c.variant, c.message) == ("other_profile", "sub", "", lc.H265_ALTERNATE_HE)
    # (b) else the transcoded H.264 variant of the requested profile
    c = lc.choose("auto", "main", H265_BOTH, False)
    assert (c.kind, c.profile, c.variant) == ("transcode", "main", "h264") and c.fallback
    # transcoding off (cap 0): nothing this browser can play - the player's next step (MSE) or the message
    c = lc.choose("auto", "main", H265_BOTH, False, max_transcodes=0)
    assert (c.kind, c.message) == ("unsupported", lc.H265_UNSUPPORTED_HE)


def test_choose_plays_as_is_when_nothing_is_wrong():
    for codecs in (H265_MAIN, {"main": "h264", "sub": "h265"}, {"main": None, "sub": None}):
        assert lc.choose("auto", "main", codecs, True).kind == "native"  # the browser decodes H.265 on this transport
    assert lc.choose("auto", "main", {"main": "h264", "sub": "h265"}, False).kind == "native"  # requested stream is H.264
    assert lc.choose("auto", "main", {"main": None, "sub": "h264"}, False).kind == "native"  # unknown codec: as it is
    assert lc.choose("auto", "main", H265_MAIN, None).kind == "native"  # an older player that did not say
    assert lc.choose("off", "main", H265_BOTH, False).kind == "native"  # the setting "כבוי"


def test_choose_sub_and_transcode_policies():
    assert lc.choose("sub", "main", H265_MAIN, False).profile == "sub"
    assert lc.choose("sub", "main", H265_BOTH, False).kind == "unsupported"  # never transcodes
    assert lc.choose("transcode", "main", H265_MAIN, False).kind == "transcode"  # never the other profile
    assert lc.choose("transcode", "sub", {"main": "h264", "sub": "h265"}, False).variant == "h264"
    assert lc.choose("transcode", "main", H265_MAIN, False, max_transcodes=0).kind == "unsupported"
    assert lc.choose("bogus", "main", H265_MAIN, False).kind == "other_profile"  # an unknown stored value reads as auto


# ---------------------------------------------------------------- naming inside the smplwise_ namespace


def test_transcode_stream_naming_stays_in_our_namespace():
    name = lc.transcode_stream_name("nvr-1", 3, "main")
    assert name == "smplwise_nvr-1_ch3_main_h264" and lc.is_transcode_stream(name)
    assert lc.transcode_source("smplwise_nvr-1_ch3_main") == "ffmpeg:smplwise_nvr-1_ch3_main#video=h264"
    for bad in ("res18", "door-1", "smplwise_nvr-1_ch3_main_h264", "smplwise_a b", "rtsp://user:pw@host/x"):
        with pytest.raises(ValueError):
            lc.transcode_source(bad)
    with pytest.raises(ValueError):
        lc.transcode_stream_name("ha_x", 1, "main")  # never in the Home Assistant cameras' own namespace
    with pytest.raises(ValueError):
        lc.transcode_stream_name("nvr-1", 1, "hls")
    assert not lc.is_transcode_stream("smplwise_nvr-1_ch3_main") and not lc.is_transcode_stream("other_h264")


# ---------------------------------------------------------------- the cap


def test_transcode_budget_caps_distinct_streams():
    b = lc.TranscodeBudget()
    assert b.acquire("t1", "s_a", 2) and b.acquire("t2", "s_b", 2)
    assert not b.acquire("t3", "s_c", 2)  # a third distinct transcode is refused
    assert b.acquire("t4", "s_a", 2)  # another viewer of a running transcode shares go2rtc's one ffmpeg
    assert b.active() == {"s_a", "s_b"}
    b.release("t2")
    assert b.acquire("t3", "s_c", 2)
    b.release("t1")
    assert "s_a" in b.active()  # t4 still watches it
    b.release("t4")
    b.release("nope")  # releasing an unknown token is harmless
    assert b.active() == {"s_c"}
    assert not lc.TranscodeBudget().acquire("x", "s", 0)  # 0 = never transcode


# ---------------------------------------------------------------- the setting


def test_h265_settings_schema(client):
    s = client.get("/api/v1/settings").json()["settings"]
    assert s["media.h265_policy"] == "auto" and s["media.h265_max_transcodes"] == 2
    for v in ("auto", "sub", "transcode", "off"):
        assert client.patch("/api/v1/settings", json={"media.h265_policy": v}).status_code == 200
    for bad in ("", "always", "AUTO", "main"):
        assert client.patch("/api/v1/settings", json={"media.h265_policy": bad}).status_code == 422, bad
    assert client.patch("/api/v1/settings", json={"media.h265_max_transcodes": 0}).json()["settings"]["media.h265_max_transcodes"] == 0
    for bad in (-1, 17, "x"):
        assert client.patch("/api/v1/settings", json={"media.h265_max_transcodes": bad}).status_code == 422, bad


# ---------------------------------------------------------------- the live socket


class FakeGo2rtc:
    store: dict[str, list[str]] = {}
    writes: list[tuple[str, str]] = []

    def __init__(self, *a, **k):
        pass

    def list_streams(self):
        return {n: g2.StreamInfo(name=n, sources=list(s), online=False) for n, s in self.store.items()}

    def ensure_stream(self, name, src, check=None):
        assert name.startswith("smplwise_")
        self.store[name] = [src]
        self.writes.append((name, src))
        return "created"

    def ws_url(self, name):
        return f"ws://go2rtc.test/api/ws?src={name}"

    def ws_headers(self):
        return {}


@pytest.fixture
def live(settings, monkeypatch):
    from smplwise.routers import media

    s = replace(settings, nvr_host="nvr.local", nvr_user="u", nvr_password="p", go2rtc_url="http://go2rtc.test:1984")
    app = create_app(s)
    c = TestClient(app)
    cam = c.post("/api/v1/cameras", json={"channel": 5, "alias": "ch5"}).json()
    FakeGo2rtc.store = {"res18": ["rtsp://***@x/1"]}
    FakeGo2rtc.writes = []
    monkeypatch.setattr(media.g2, "Go2rtc", FakeGo2rtc)
    opened: list[str] = []

    async def relay(websocket, upstream_url, headers, on_down, should_stop=None, on_text=None):
        opened.append(upstream_url.rsplit("src=", 1)[1])
        return "client_closed"

    monkeypatch.setattr(media, "relay_ws", relay)
    lc.BUDGET.held.clear()

    def codecs(main, sub):
        with app.state.db.connection() as conn:
            conn.execute("UPDATE cameras SET capabilities_json = ? WHERE id = ?",
                         (json.dumps({"encoding": {"main": {"codec": main}, "sub": {"codec": sub}}}), cam["id"]))

    class Live:
        pass

    lv = Live()
    lv.c, lv.cam, lv.opened, lv.codecs, lv.app = c, cam, opened, codecs, app
    yield lv
    lc.BUDGET.held.clear()


def _frames(lv, query):
    out = []
    try:
        with lv.c.websocket_connect(f"/api/v1/media/live/{lv.cam['id']}/ws?{query}") as ws:
            while True:
                out.append(json.loads(ws.receive_text()))
    except WebSocketDisconnect as exc:
        return out, exc.code
    return out, None


def test_ws_h265_main_falls_back_to_the_h264_sub(live):
    live.codecs("H.265", "H.264")
    frames, _ = _frames(live, "profile=main&h265=0")
    assert live.opened == ["smplwise_nvr-1_ch5_sub"]
    hello = frames[0]
    assert hello["type"] == "arx/stream" and hello["value"]["kind"] == "other_profile" and hello["value"]["profile"] == "sub"
    assert hello["value"]["message"] == lc.H265_ALTERNATE_HE


def test_ws_without_the_parameter_or_with_h265_support_plays_as_is(live):
    live.codecs("H.265", "H.264")
    frames, _ = _frames(live, "profile=main")
    assert live.opened == ["smplwise_nvr-1_ch5_main"] and frames == []  # an older player: no frame it does not know
    frames, _ = _frames(live, "profile=main&h265=1")
    assert live.opened[-1] == "smplwise_nvr-1_ch5_main" and frames[0]["value"]["kind"] == "native"


def test_ws_transcode_writes_one_namespaced_stream_from_our_own(live):
    live.codecs("H.265", "H.265")
    frames, _ = _frames(live, "profile=main&h265=0")
    assert live.opened == ["smplwise_nvr-1_ch5_main_h264"]
    assert ("smplwise_nvr-1_ch5_main_h264", "ffmpeg:smplwise_nvr-1_ch5_main#video=h264") in FakeGo2rtc.writes
    assert all(n.startswith("smplwise_") for n, _ in FakeGo2rtc.writes) and FakeGo2rtc.store["res18"] == ["rtsp://***@x/1"]
    assert frames[0]["value"]["variant"] == "h264"
    assert lc.BUDGET.active() == set()  # released when the socket ended


def test_ws_transcode_cap_refuses_with_its_reason(live):
    live.codecs("H.265", "H.265")
    assert live.c.patch("/api/v1/settings", json={"media.h265_max_transcodes": 1}).status_code == 200
    lc.BUDGET.acquire("someone", "smplwise_nvr-1_ch9_main_h264", 1)  # another camera already transcodes
    frames, code = _frames(live, "profile=main&h265=0")
    assert code == 4430 and frames[0]["value"] == "transcode_cap" and frames[0]["max"] == 1 and "(1)" in frames[0]["message"]
    assert live.opened == [] and not any(n.endswith("_h264") for n, _ in FakeGo2rtc.writes)
    # the slot frees; another viewer already watches this camera's transcode: a new viewer shares it within the cap of 1
    lc.BUDGET.release("someone")
    assert lc.BUDGET.acquire("first", "smplwise_nvr-1_ch5_main_h264", 1)
    _frames(live, "profile=main&h265=0")
    assert live.opened == ["smplwise_nvr-1_ch5_main_h264"]


def test_ws_no_alternative_under_the_policy_is_a_clear_refusal(live):
    live.codecs("H.265", "H.265")
    assert live.c.patch("/api/v1/settings", json={"media.h265_policy": "sub"}).status_code == 200
    frames, code = _frames(live, "profile=main&h265=0")
    assert code == 4415 and frames == [{"type": "error", "value": "h265_unsupported", "message": lc.H265_UNSUPPORTED_HE}]
    assert live.opened == []
    assert live.c.patch("/api/v1/settings", json={"media.h265_policy": "off"}).status_code == 200
    _frames(live, "profile=main&h265=0")
    assert live.opened == ["smplwise_nvr-1_ch5_main"]  # "כבוי": the stream as it is


def test_ws_unknown_registry_codec_uses_what_go2rtc_reported(live, monkeypatch):
    live.codecs(None, None)

    class Observed(FakeGo2rtc):
        def list_streams(self):
            out = super().list_streams()
            out["smplwise_nvr-1_ch5_main"] = g2.StreamInfo("smplwise_nvr-1_ch5_main", ["rtsp://x"], True, video_codec="h265")
            out["smplwise_nvr-1_ch5_sub"] = g2.StreamInfo("smplwise_nvr-1_ch5_sub", ["rtsp://x"], True, video_codec="h264")
            return out

    from smplwise.routers import media

    monkeypatch.setattr(media.g2, "Go2rtc", Observed)
    _frames(live, "profile=main&h265=0")
    assert live.opened == ["smplwise_nvr-1_ch5_sub"]


def test_live_info_reports_codecs_and_the_policy(live):
    live.codecs("H.265", "H.264")
    info = live.c.get(f"/api/v1/media/live/{live.cam['id']}?profile=main").json()
    assert info["codecs"] == {"main": "h265", "sub": "h264"}
    assert info["h265"] == {"policy": "auto", "max_transcodes": 2, "active_transcodes": 0}
