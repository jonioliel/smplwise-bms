"""PROVISION2 (2026-10-20): API v2 reads behind capability detection, audio in video, PTZ / audio facts - FAKE DEVICE ONLY.

No real NVR is contacted: every request goes to `fake_provision.FakeProvision` on httpx's transport. The v1 rule of every test
here: a device that does not list a v2 command in its own GetSupportedAPIs keeps exactly its v1 reads, and nothing is written."""
from __future__ import annotations

import sys
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from smplwise.services.recorders import provision_isr as pisr
from smplwise.services.recorders import provision_isr_xml as px
from smplwise.services.recorders import registry, vendor_io

sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from fake_provision import FakeProvision, settings_for  # noqa: E402

V2 = ["GetSupportedAPIs", "GetChannelInfo", "GetAlarmStatusInfo", "GetStreamCaps", "GetVideoStreamConfig", "SetVideoStreamConfig"]


@pytest.fixture()
def fake() -> FakeProvision:
    pisr.clear_auth_cache()
    return FakeProvision()


def make(settings, fake, **extra) -> pisr.ProvisionIsrAdapter:
    return pisr.ProvisionIsrAdapter("nvr-2", settings_for(settings, **extra), transport=fake.transport())


# ------------------------------------------------------------------------------------------------ API level detection

def test_v1_device_is_level_v1_and_keeps_its_v1_channel_read(settings, fake):
    a = make(settings, fake, osd_names=False)
    assert a.api_level() == "v1"
    facts = a.api_facts()
    assert facts["level"] == "v1" and facts["v2_reads"] == [] and facts["partial_write"] is False and facts["commands"] is None
    chans = a.list_channels()
    assert [c.channel for c in chans] == [1, 2, 3, 4]
    assert not any("GetChannelInfo" in h for h in fake.hits)
    assert fake.writes == []


def test_v2_device_reads_names_status_in_one_call_and_never_returns_the_ip(settings, fake):
    fake.supported_apis = V2
    fake.names = {1: "Gate", 2: "Lobby"}
    a = make(settings, fake)
    assert a.api_level() == "v2"
    chans = a.list_channels()
    assert [(c.channel, c.name, c.online) for c in chans] == [(1, "Gate", True), (2, "Lobby", True), (3, "V2-3", False), (4, "V2-4", False)]
    assert not any("GetChannelList" in h or "GetImageOsdConfig" in h for h in fake.hits)
    assert "192.0.2" not in repr(chans)
    assert a.api_facts()["v2_reads"] == ["GetAlarmStatusInfo", "GetChannelInfo"] and a.api_facts()["partial_write"] is True
    assert fake.writes == []


def test_v2_listed_but_failing_channel_info_falls_back_to_v1(settings, fake):
    fake.supported_apis = V2
    fake.fail = {"GetChannelInfo": 1}
    a = make(settings, fake, osd_names=False)
    assert [c.channel for c in a.list_channels()] == [1, 2, 3, 4]
    assert any("GetChannelList" in h for h in fake.hits)


def test_parse_channel_info_types_and_bounds():
    xml = ('<config xmlns="http://www.ipc.com/ver10"><channelList><item><channelId>2</channelId><name><![CDATA[Yard]]></name>'
           '<status>videoLoss</status><attribute>PTZ</attribute><ip>192.0.2.9</ip></item><item><channelId>0</channelId></item>'
           '<item><channelId>2</channelId></item></channelList></config>')
    assert px.parse_channel_info(xml) == [{"channel": 2, "name": "Yard", "status": "videoLoss", "type": "ptz"}]


# ------------------------------------------------------------------------------------------------ v2 health alarms

def test_v2_health_reads_device_disk_alarms(settings, fake):
    fake.supported_apis = V2
    fake.device_alarms = {"diskFull": True, "noDisk": False, "hddPullOut": False, "diskRWError": True, "illegalAccess": False}
    a = make(settings, fake)
    h = a.read_health()
    assert h.disk_alarms == ("diskFull", "diskRWError")
    assert any("GetAlarmStatusInfo" in x for x in fake.hits) and not any(x.endswith("/GetAlarmStatus") for x in fake.hits)
    assert "FAKESERIAL0002" not in repr(h)


def test_v1_health_keeps_get_alarm_status(settings, fake):
    a = make(settings, fake)
    a.read_health()
    assert any(x.endswith("/GetAlarmStatus") for x in fake.hits) and not any("GetAlarmStatusInfo" in x for x in fake.hits)


def test_device_alarm_group_parser_both_shapes():
    v2 = ('<config xmlns="http://www.ipc.com/ver10"><alarmStatusInfo><deviceAlarmStatus><diskFull>true</diskFull>'
          '<diskRWError><item><sn>X</sn><status>false</status></item><item><sn>Y</sn><status>true</status></item></diskRWError>'
          '</deviceAlarmStatus><motionAlarm><item id="3">true</item></motionAlarm></alarmStatusInfo></config>')
    got = px.parse_alarm_status(v2)
    assert got == {("diskFull", None): True, ("diskRWError", 1): False, ("diskRWError", 2): True, ("motionAlarm", 3): True}
    v1 = '<config xmlns="http://www.ipc.com/ver10"><alarmStatusInfo><motionAlarm type="boolean" id="2">true</motionAlarm></alarmStatusInfo></config>'
    assert px.parse_alarm_status(v1) == {("motionAlarm", 2): True}


# ------------------------------------------------------------------------------------------------ v2 stream caps

def test_v2_caps_fill_the_bitrate_list_and_h265_profiles(settings, fake):
    fake.shape = "live"  # GetVideoStreamConfig without bitrate lists, like the owner's NVR
    fake.caps_v2 = True
    fake.codec = {1: "h265"}
    a = make(settings, fake, writes_enabled=True)
    opts = a.stream_options("101").options
    assert opts["bitrate_list"] == [1024, 2048, 4096, 8192]
    assert opts["profile"].get("H.265") == ["main"]


def test_v1_caps_leave_the_options_as_before(settings, fake):
    fake.shape = "live"
    a = make(settings, fake)
    opts = a.stream_options("101").options
    assert opts["bitrate_list"] == []
    caps = a.stream_caps(1)["streams"][1]
    assert caps["profiles_h265"] == [] and caps["bitrate_list"] == []


# ------------------------------------------------------------------------------------------------ audio in video

URL = "rtsp://u:p@h:554/chID=1&streamType=main"


@pytest.mark.parametrize(("mode", "suffix"), [(None, ""), ("off", ""), ("copy", "#audio=copy"), ("opus", "#audio=opus"),
                                              ("copy_opus", "#audio=copy#audio=opus"), ("bogus", ""), ("COPY", "#audio=copy")])
def test_live_audio_suffix_is_off_by_default(settings, mode, suffix):
    extra = {} if mode is None else {"live_audio": mode}
    assert vendor_io.go2rtc_source(settings_for(settings, **extra), URL) == f"ffmpeg:{URL}#video=copy{suffix}"


def test_native_rtsp_source_ignores_live_audio(settings):
    assert vendor_io.go2rtc_source(settings_for(settings, go2rtc_source="rtsp", live_audio="copy"), URL) == URL


def test_audio_config_live_shape_has_no_switch(settings, fake):
    a = make(settings, fake)
    got = a.audio_config(1)
    assert got["enabled"] is None and got["codec"] == "G711A" and got["input"] == "MIC" and got["codecs"] == ["G711A", "G711U"]
    fake.audio = {2: {"enabled": True, "codec": "G711U", "input": "LIN"}}
    assert a.audio_config(2)["enabled"] is True and a.audio_config(2)["codec"] == "G711U"
    assert fake.writes == []


def test_audio_parser_v1_guide_example_with_switch():
    xml = ('<config xmlns="http://www.ipc.com/ver10"><types><audioEncode><enum>G711A</enum><enum>AAC</enum></audioEncode></types>'
           '<audioInSwitch type="boolean">false</audioInSwitch><audioEncode>AAC</audioEncode><audioSampleRate>16000</audioSampleRate></config>')
    got = px.parse_audio_stream_config(xml)
    assert got == {"enabled": False, "codec": "AAC", "input": None, "sample_rate": 16000, "codecs": ["G711A", "AAC"], "inputs": []}


# ------------------------------------------------------------------------------------------------ PTZ / audio facts

def test_camera_facts_non_ptz_channel_like_the_live_nvr(settings, fake):
    a = make(settings, fake)
    f = a.camera_facts(1)
    assert f["ptz"]["state"] == "unsupported" and f["ptz"]["presets"] is None
    assert f["audio_in"]["state"] == "unknown" and f["audio_in"]["codec"] == "G711A" and f["audio_in"]["live"] == "off"
    assert f["audio"]["state"] == "unknown"
    assert fake.writes == []


def test_camera_facts_ptz_channel_with_presets_and_audio_on(settings, fake):
    fake.ptz = {2: ["Door", "Gate"]}
    fake.audio = {2: {"enabled": True}}
    a = make(settings, fake, live_audio="copy")
    f = a.camera_facts(2)
    assert f["ptz"]["state"] == "supported" and f["ptz"]["preset_count"] == 2
    assert f["ptz"]["presets"] == [{"id": 1, "name": "Door"}, {"id": 2, "name": "Gate"}] and f["ptz"]["speed"] == {"min": 1, "max": 8}
    assert f["audio_in"]["state"] == "on" and f["audio_in"]["live"] == "copy"


def test_camera_facts_stop_on_a_refused_login(settings, fake):
    from smplwise.errors import ApiError

    fake.auth = "digest"
    a = make(settings, fake, auth="basic")
    with pytest.raises(ApiError) as e:
        a.camera_facts(1)
    assert e.value.code == "source_forbidden"


def test_registration_offers_live_audio_off_first():
    spec = {}
    orig = getattr(registry, "register_vendor", None)
    if orig is None:
        pytest.skip("no registry seam")

    def capture(s, cls):
        spec["s"] = s
        return lambda: None

    registry.register_vendor = capture
    try:
        pisr.register(selectable=True)
    finally:
        registry.register_vendor = orig
    field = next(f for f in spec["s"].fields if f.key == "live_audio")
    assert field.options[0][0] == "off"


# ------------------------------------------------------------------------------------------------ the camera capabilities route

def wait_cameras(app, n: int) -> dict[int, str]:
    deadline = time.monotonic() + 25
    while time.monotonic() < deadline:
        with app.state.db.connection(mode="read") as conn:
            rows = conn.execute("SELECT id, channel FROM cameras WHERE recorder_id = 'nvr-1'").fetchall()
        if len(rows) >= n:
            return {int(r["channel"]): r["id"] for r in rows}
        time.sleep(0.05)
    raise AssertionError("discovery did not finish")


def test_capabilities_route_asks_the_provision_adapter_not_isapi(settings, fake, monkeypatch):
    from smplwise.main import create_app

    fake.channels = {1: "online", 2: "online"}
    fake.ptz = {2: ["Door"]}
    fake.install(monkeypatch)
    monkeypatch.setitem(registry.VENDORS, "provision_isr", pisr.ProvisionIsrAdapter)
    s = settings_for(settings, auth="basic", osd_names=False)
    app = create_app(s)
    with TestClient(app) as c:
        ids = wait_cameras(app, 2)
        r = c.get(f"/api/v1/cameras/{ids[2]}/capabilities")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["ptz"]["state"] == "supported" and body["ptz"]["preset_count"] == 1 and body["audio_in"]["live"] == "off"
    assert not any("PTZCtrl" in h or "TwoWayAudio" in h for h in fake.hits)
    assert fake.writes == []
