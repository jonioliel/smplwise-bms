"""CR-008 D7 (step 6): the codec check. The discovery reads the NVR's streaming channels (read-only ISAPI GET), stores
each camera's main / sub encoding and its WebRTC verdict in the capability registry (cameras.capabilities_json), and
the facts reach the camera list / capabilities, /health (counts), the health report (names + hints, a warning only when
remote viewers get the main stream first) and the setup wizard's NVR step (Hebrew hints with the NVR menu path).
Nothing here writes to a device."""
from __future__ import annotations

import dataclasses
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from smplwise.db import Database, set_setting
from smplwise.main import create_app
from smplwise.services import autosync, events_ingest, health_report, nvr, stream_codecs
from smplwise.services import setup_wizard as wizard

sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from fake_devices import GO2RTC_HOST, NVR_HOST, FakeDevices  # noqa: E402

NS = 'xmlns="http://www.hikvision.com/ver20/XMLSchema"'
ISAPI_NS = 'xmlns="http://www.isapi.org/ver20/XMLSchema"'


def _channel(sid: str, video: str) -> str:
    return (f'<StreamingChannel version="2.0" {ISAPI_NS}><id>{sid}</id><channelName>{sid}</channelName><enabled>true</enabled>'
            "<Transport><ControlProtocolList><ControlProtocol><streamingTransport>RTSP</streamingTransport></ControlProtocol></ControlProtocolList></Transport>"
            f"<Video><enabled>true</enabled><dynVideoInputChannelID>{sid[:-2]}</dynVideoInputChannelID>{video}</Video>"
            "<Audio><enabled>true</enabled><audioCompressionType>G.711ulaw</audioCompressionType></Audio></StreamingChannel>")


# the lab document's shape (structure only, values generic): main H.264 with SVC on, sub H.264 without an SVC element
LAB_SHAPED = (f'<?xml version="1.0" encoding="UTF-8" ?><StreamingChannelList version="1.0" {NS}>'
              + _channel("101", "<videoCodecType>H.264</videoCodecType><videoResolutionWidth>2560</videoResolutionWidth><videoResolutionHeight>1440</videoResolutionHeight>"
                         "<maxFrameRate>0</maxFrameRate><GovLength>50</GovLength><SVC><enabled>true</enabled><SVCMode>manual</SVCMode></SVC><SmartCodec><enabled>false</enabled></SmartCodec>")
              + _channel("102", "<videoCodecType>H.264</videoCodecType><videoResolutionWidth>640</videoResolutionWidth><videoResolutionHeight>360</videoResolutionHeight>"
                         "<maxFrameRate>2000</maxFrameRate><GovLength>50</GovLength><SmartCodec><enabled>false</enabled></SmartCodec>")
              + _channel("201", "<videoCodecType>H.265</videoCodecType><videoResolutionWidth>2688</videoResolutionWidth><videoResolutionHeight>1520</videoResolutionHeight>"
                         "<maxFrameRate>2500</maxFrameRate><H265Profile>Main</H265Profile><SVC><enabled>false</enabled></SVC>")
              + _channel("202", "<videoCodecType>H.264</videoCodecType><H264Profile>Baseline</H264Profile>")
              + _channel("301", "<videoCodecType>H.264</videoCodecType><H264Profile>High</H264Profile><BFrame><enabled>true</enabled></BFrame>")
              + _channel("302", "<videoCodecType>H.264</videoCodecType><H264Profile>High</H264Profile><BFrameNum>0</BFrameNum><SVC><enabled>false</enabled></SVC>")
              + _channel("303", "<videoCodecType>H.264</videoCodecType>")  # a third stream: ignored
              + _channel("401", "<videoCodecType>MJPEG</videoCodecType>")
              + "</StreamingChannelList>")


def test_parse_streaming_channels_codec_svc_b_frames_and_verdicts():
    enc = nvr.parse_streaming_channels(LAB_SHAPED)
    assert sorted(enc) == [1, 2, 3, 4] and sorted(enc[3]) == ["main", "sub"], "N03 is not a main or sub stream"
    m1, s1 = enc[1]["main"], enc[1]["sub"]
    assert (m1["codec"], m1["svc"], m1["smart_codec"], m1["resolution"], m1["fps"], m1["gov_length"]) == ("H.264", True, False, "2560x1440", None, 50)
    assert (m1["webrtc"], m1["reason"]) == ("no", "svc"), "the lab's main streams: H.264 with SVC - did not decode over WebRTC"
    assert (s1["codec"], s1["svc"], s1["fps"], s1["webrtc"], s1["reason"]) == ("H.264", None, 20.0, "ok", "h264")
    assert (enc[2]["main"]["codec"], enc[2]["main"]["profile"], enc[2]["main"]["webrtc"], enc[2]["main"]["reason"]) == ("H.265", "Main", "no", "h265")
    assert (enc[2]["sub"]["profile"], enc[2]["sub"]["webrtc"], enc[2]["sub"]["reason"]) == ("Baseline", "ok", "h264_no_b_frames")
    assert (enc[3]["main"]["b_frames"], enc[3]["main"]["webrtc"], enc[3]["main"]["reason"]) == (True, "no", "b_frames")
    assert (enc[3]["sub"]["b_frames"], enc[3]["sub"]["webrtc"], enc[3]["sub"]["reason"]) == (False, "ok", "h264_no_b_frames"), "a B-frame count of 0 is 'no B-frames'"
    assert (enc[4]["main"]["codec"], enc[4]["main"]["webrtc"]) == ("MJPEG", "no")
    # a single <StreamingChannel> document (GET /ISAPI/Streaming/channels/101) parses the same way
    one = f'<?xml version="1.0" encoding="UTF-8" ?>' + _channel("101", "<videoCodecType>H.265</videoCodecType>")
    assert nvr.parse_streaming_channels(one)[1]["main"]["webrtc"] == "no"


def test_track_description_fallback_and_unknowns():
    assert nvr.encoding_from_track(None) is None and nvr.encoding_from_track({}) is None
    bp = nvr.encoding_from_track(nvr.parse_track_description("trackType=standard,contentType=video,codecType=H.264-BP,resolution=2560x1440,framerate=25.0 fps"))
    assert (bp["codec"], bp["profile"], bp["source"]) == ("H.264", "BP", "track")
    assert (bp["webrtc"], bp["reason"]) == ("unknown", "track_description_only"), "a track Description never says 'plays' (review M1)"
    hp = nvr.encoding_from_track({"codec": "H.264"})
    assert (hp["webrtc"], hp["reason"]) == ("unknown", "track_description_only"), "a track Description says nothing about B-frames / SVC"
    assert nvr.encoding_from_track({"codec": "H.265"})["webrtc"] == "no", "H.265 / MJPEG from a track Description: will not play"
    assert nvr.encoding_from_track({"codec": "MJPEG"})["webrtc"] == "no"


def test_lab_shaped_track_vs_streaming_mismatch():
    """Synthetic, in the lab's shape: every recording track says H.264-BP, while the streaming document shows an H.264
    main with SVC on (7 lab cameras) or H.265 (3 lab cameras). The streaming document decides; without it the track's
    BP yields "unknown", never "plays"."""
    track = nvr.parse_track_description("trackType=standard,contentType=video,codecType=H.264-BP,resolution=2560x1440,framerate=25.0 fps")
    ch = nvr.DiscoveredChannel(channel=1, name="כניסה", online=True, main_track=101, sub_track=102, stream=track, sub_stream=track)
    streaming = nvr.parse_streaming_channels(LAB_SHAPED)
    enc = stream_codecs.build(ch, streaming[1], None, error=None, now="2026-09-29T00:00:00Z")
    assert (enc["main"]["source"], enc["main"]["webrtc"], enc["main"]["reason"]) == ("isapi", "no", "svc")
    enc = stream_codecs.build(dataclasses.replace(ch, channel=2), streaming[2], None, error=None, now="2026-09-29T00:00:00Z")
    assert (enc["main"]["webrtc"], enc["main"]["reason"]) == ("no", "h265")
    # the streaming document cannot be read (and no earlier reading): the tracks' BP is "unknown", and no hint claims either way
    enc = stream_codecs.build(ch, None, None, error="source_error", now="2026-09-29T00:00:00Z")
    assert (enc["main"]["source"], enc["main"]["webrtc"], enc["sub"]["webrtc"]) == ("track", "unknown", "unknown")
    assert stream_codecs.main_hint("כניסה", 1, enc["main"], None) is None
    assert nvr.webrtc_verdict({"codec": None}) == ("unknown", "codec_unknown")
    assert nvr.webrtc_verdict({"codec": "VP8"}) == ("unknown", "codec_other")


def test_hint_text_and_menu_path():
    h265 = {"codec": "H.265", "svc": False, "webrtc": "no", "reason": "h265"}
    hint = stream_codecs.main_hint("כניסה", 3, h265, "DS-7616NI-Q2")
    assert hint == ("הזרם הראשי של כניסה מקודד H.265 - לא יתנגן ב-WebRTC; לשינוי: NVR DS-7616NI-Q2 → Configuration → Video/Audio → Video → "
                    "Camera 3 → Main Stream (Continuous) → Video Encoding: H.264, B-frames off")
    svc = {"codec": "H.264", "svc": True, "webrtc": "no", "reason": "svc"}
    assert stream_codecs.main_hint("לובי", 1, svc, None) == "הזרם הראשי של לובי מקודד H.264 עם SVC - לא יתנגן ב-WebRTC; לשינוי: NVR → Encoding → Main stream → SVC off, B-frames off"
    assert stream_codecs.main_hint("x", 1, {"codec": "H.264", "webrtc": "ok"}, None) is None
    assert stream_codecs.main_hint("x", 1, {"codec": "H.264", "webrtc": "unknown"}, None) is None
    assert stream_codecs.main_hint("x", 1, None, None) is None


@pytest.fixture()
def fake(monkeypatch) -> FakeDevices:
    f = FakeDevices()
    f.install(monkeypatch)
    return f


@pytest.fixture(autouse=True)
def clean_state(monkeypatch):
    for k in list(autosync.STATE):
        monkeypatch.setitem(autosync.STATE, k, None)
    monkeypatch.setattr(events_ingest.STATE, "connected", True)
    wizard.reset()
    health_report.invalidate()  # the report's device probes are cached process-wide: never hand the fakes' answers on
    monkeypatch.setattr(wizard, "CHECK_EVERY_S", 0.0)
    yield
    wizard.reset()
    health_report.invalidate()


def _devices(settings, **extra):
    return dataclasses.replace(settings, nvr_host=NVR_HOST, nvr_user="wizard", nvr_password="fake-password", go2rtc_url=f"http://{GO2RTC_HOST}:1984", **extra)


def _sync(c: TestClient) -> None:
    r = c.post("/api/v1/cameras/sync")
    assert r.status_code == 200, r.text


def test_discovery_stores_encodings_and_health_counts_them(settings, fake):
    fake.nvr["encodings_by_channel"] = {2: {"main": {"codec": "H.264", "svc": False}}, 3: {"main": {"codec": "H.264", "svc": True}}}
    s = _devices(settings)
    c = TestClient(create_app(s))
    _sync(c)
    cams = c.get("/api/v1/cameras").json()["cameras"]
    assert [x["channel"] for x in cams] == [1, 2, 3, 4]
    by = {x["channel"]: x for x in cams}
    assert (by[1]["encoding"]["main"]["codec"], by[1]["encoding"]["main"]["webrtc"], by[1]["encoding"]["main"]["reason"]) == ("H.265", "no", "h265")
    assert (by[2]["encoding"]["main"]["webrtc"], by[3]["encoding"]["main"]["reason"]) == ("ok", "svc")
    assert all(x["encoding"]["sub"]["webrtc"] == "ok" and x["encoding"]["error"] is None for x in cams)
    assert by[1]["stream"]["codec"] == "H.265", "the track Description is still stored as before"

    h = c.get("/api/v1/health").json()["video_codecs"]
    assert h["cameras"] == 4 and h["checked"] == 4 and h["main"] == {"ok": 1, "no": 3, "unknown": 0} and h["sub"] == {"ok": 4, "no": 0, "unknown": 0}
    assert "main_not_webrtc" not in h, "/health (every signed-in user) carries counts only"

    # the capability registry on the camera's capabilities, with the hint (the fake NVR's model names the menu path)
    caps_video = c.get(f"/api/v1/cameras/{by[1]['id']}/capabilities").json()["video"]
    assert caps_video["main"]["webrtc"] == "no"
    assert caps_video["hint"].startswith("הזרם הראשי של מצלמה 1 מקודד H.265 - לא יתנגן ב-WebRTC; לשינוי: NVR DS-7616NI-FAKE → Configuration")
    assert c.get(f"/api/v1/cameras/{by[2]['id']}/capabilities").json()["video"]["hint"] is None

    # the health report: remote channel off → the facts, status ok
    rep = {x["id"]: x for x in c.get("/api/v1/health/report").json()["checks"]}
    v = rep["video_webrtc"]
    assert v["status"] == "ok" and v["meta"]["main"]["no"] == 3 and "מצלמה 1 (H.265)" in v["detail"] and "מצלמה 3 (SVC)" in v["detail"]
    assert [b["channel"] for b in v["meta"]["main_not_webrtc"]] == [1, 3, 4]
    assert fake.writes == [], "the codec check never writes to the NVR (or to go2rtc)"


def test_health_report_warns_only_when_remote_viewers_get_main_first(settings, fake):
    s = _devices(settings, remote_access=True)
    app = create_app(s)
    c = TestClient(app)
    _sync(c)
    v = next(x for x in c.get("/api/v1/health/report").json()["checks"] if x["id"] == "video_webrtc")
    assert v["status"] == "warn" and v["meta"]["remote_main_first"] is True
    with Database(s.db_path).connection() as conn:
        set_setting(conn, "remote.default_profile", "sub")
    v = next(x for x in c.get("/api/v1/health/report").json()["checks"] if x["id"] == "video_webrtc")
    assert v["status"] == "ok" and v["meta"]["remote_main_first"] is False
    # all main streams fixed on the NVR: no warning even with main first
    with Database(s.db_path).connection() as conn:
        set_setting(conn, "remote.default_profile", "main")
    fake.nvr["encodings"]["main"] = {"codec": "H.264", "svc": False}
    _sync(c)
    v = next(x for x in c.get("/api/v1/health/report").json()["checks"] if x["id"] == "video_webrtc")
    assert v["status"] == "ok" and v["meta"]["main"] == {"ok": 4, "no": 0, "unknown": 0}


def test_streaming_document_unreadable_keeps_the_last_reading_or_falls_back_to_tracks(settings, fake):
    s = _devices(settings)
    c = TestClient(create_app(s))
    fake.nvr["streaming"] = False  # notSupport: the track Description (codecType=H.265) is all there is
    _sync(c)
    enc = c.get("/api/v1/cameras").json()["cameras"][0]["encoding"]
    assert enc["main"]["source"] == "track" and enc["main"]["webrtc"] == "no" and enc["sub"] is None and enc["error"] == "source_error"
    fake.nvr["streaming"] = True
    _sync(c)
    enc = c.get("/api/v1/cameras").json()["cameras"][0]["encoding"]
    assert enc["main"]["source"] == "isapi" and enc["error"] is None
    fake.nvr["streaming"] = False
    _sync(c)
    enc = c.get("/api/v1/cameras").json()["cameras"][0]["encoding"]
    assert enc["main"]["source"] == "isapi" and enc["error"] == "source_error", "a failed read keeps the last ISAPI reading"
    assert fake.writes == []


def test_setup_wizard_nvr_step_shows_the_hints(settings, fake):
    fake.nvr["encodings_by_channel"] = {2: {"main": {"codec": "H.264", "svc": False}}}
    s = _devices(settings)
    c = TestClient(create_app(s))
    nvr_step = next(x for x in c.post("/api/v1/setup/check/nvr").json()["steps"] if x["id"] == "nvr")
    assert nvr_step["status"] == "done"
    hints = [w for w in nvr_step["warnings"] if w["code"] == "main_not_webrtc"]
    assert [w["message"] for w in hints][0] == ("הזרם הראשי של מצלמה 1 מקודד H.265 - לא יתנגן ב-WebRTC; לשינוי: NVR DS-7616NI-FAKE → Configuration → Video/Audio → "
                                                "Video → Camera 1 → Main Stream (Continuous) → Video Encoding: H.264, B-frames off")
    assert len(hints) == 3 and all(w["link"]["href"] == "#/system/diagnostics?tab=remote" for w in hints)
    fact = next(f for f in nvr_step["facts"] if f["label"] == "זרם ראשי ב־WebRTC")
    assert fact["value"] == "1 מתוך 4 · 3 לא יתנגנו" and fact["tone"] == "warn"
    assert nvr_step["evidence"]["video_codecs"]["main"] == {"ok": 1, "no": 3, "unknown": 0}
    # more cameras than the warning cap: the rest are counted in one line
    fake.nvr.update(channels=7, encodings_by_channel={})
    nvr_step = next(x for x in c.post("/api/v1/setup/check/nvr").json()["steps"] if x["id"] == "nvr")
    codes = [w["code"] for w in nvr_step["warnings"]]
    assert codes.count("main_not_webrtc") == wizard.MAX_CODEC_WARNINGS and "main_not_webrtc_more" in codes
    # the background state (no live check) reads the registry the discovery filled
    wizard.reset()
    _sync(c)
    bg = next(x for x in c.get("/api/v1/setup/state").json()["steps"] if x["id"] == "nvr")
    assert bg["source"] == "background" and "main_not_webrtc" in {w["code"] for w in bg["warnings"]}
    assert bg["evidence"]["video_codecs"]["main"]["no"] == 7
    assert fake.writes == []


def test_wizard_counts_enabled_cameras_and_uses_a_short_timeout(settings, fake, monkeypatch):
    """Review nits: the wizard's live NVR check counts the enabled cameras (as /health and the report do), and its
    streaming-channels GET has a short timeout inside the check's 20 s budget."""
    s = _devices(settings)
    c = TestClient(create_app(s))
    _sync(c)
    cams = c.get("/api/v1/cameras").json()["cameras"]
    assert c.patch(f"/api/v1/cameras/{cams[0]['id']}", json={"enabled": False}).status_code == 200
    seen: list[float] = []
    real = nvr.fetch_stream_encodings
    monkeypatch.setattr(nvr, "fetch_stream_encodings", lambda settings, timeout=8.0: seen.append(timeout) or real(settings, timeout=timeout))
    step = next(x for x in c.post("/api/v1/setup/check/nvr").json()["steps"] if x["id"] == "nvr")
    assert seen == [wizard.STREAMING_TIMEOUT_S] and wizard.STREAMING_TIMEOUT_S <= 5
    assert step["evidence"]["channels"] == 4, "the channel facts still describe the whole NVR"
    assert step["evidence"]["video_codecs"]["main"] == {"ok": 0, "no": 3, "unknown": 0}
    assert next(f for f in step["facts"] if f["label"] == "זרם ראשי ב־WebRTC")["value"] == "0 מתוך 3 · 3 לא יתנגנו"
    assert c.get("/api/v1/health").json()["video_codecs"]["main"]["no"] == 3, "the same count as /health"
    assert len([w for w in step["warnings"] if w["code"] == "main_not_webrtc"]) == 3
