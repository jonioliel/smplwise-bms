"""CR-025 P1: the Provision-ISR v1 adapter (read-only) against the fake device (tests/fixtures/fake_provision.py).
No real device: every request goes through httpx.MockTransport."""
from __future__ import annotations

import dataclasses
import sys
from pathlib import Path

import pytest

from smplwise.errors import ApiError
from smplwise.services import nvr
from smplwise.services.events_ingest import normalize_type
from smplwise.services.recorders import provision_isr as pisr
from smplwise.services.recorders import provision_isr_xml as px
from smplwise.services.recorders.base import RecorderAdapter

sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from fake_provision import HOST, PASSWORD, USER, FakeProvision, settings_for  # noqa: E402


@pytest.fixture()
def fake() -> FakeProvision:
    pisr.clear_auth_cache()
    return FakeProvision()


def make(settings, fake: FakeProvision, **extra) -> pisr.ProvisionIsrAdapter:
    return pisr.ProvisionIsrAdapter("nvr-2", settings_for(settings, **extra), transport=fake.transport())


# ---------------------------------------------------------------------------------------------- the seam

def test_adapter_satisfies_the_recorder_protocol(settings, fake):
    a = make(settings, fake)
    assert isinstance(a, object) and all(callable(getattr(a, m)) for m in RecorderAdapter.__dict__ if not m.startswith("_") and m not in ("vendor",))
    caps = a.capabilities()
    assert caps.vendor == "provision_isr" and caps.read_encodings and not caps.write_encodings
    assert not caps.add_channel and not caps.remove_channel
    assert caps.live == "rtsp" and caps.events == "poll" and caps.playback == "rtsp"
    assert "svc" not in caps.encoding_fields and "b_frames" not in caps.encoding_fields
    assert fake.hits == []  # declaring capabilities makes no device call


def test_device_key_is_a_hash_never_the_address(settings, fake):
    a = make(settings, fake)
    assert a.device_key.startswith("pisr-") and HOST not in a.device_key
    other = pisr.ProvisionIsrAdapter("nvr-3", dataclasses.replace(settings_for(settings), nvr_host="other.test"), transport=fake.transport())
    assert other.device_key != a.device_key


# ---------------------------------------------------------------------------------------------- auth

def test_basic_auth_detected_from_the_challenge(settings, fake):
    a = make(settings, fake)
    h = a.health()
    assert h.online and h.model == "NVR5-8200PX" and h.firmware == "9.9.9.1(00001)" and h.error is None
    info = a.transport_info()
    assert (info["scheme"], info["auth"], info["insecure"]) == ("http", "basic", True) and info["challenge"]["scheme"] == "basic"
    # one unauthenticated probe, then the authenticated read; the scheme is cached for the next calls
    a.health()
    assert [x for x in fake.hits if x == "POST /GetDeviceInfo"] == ["POST /GetDeviceInfo"] * 3


def test_digest_auth_detected_from_the_challenge(settings, fake):
    fake.auth = "digest"
    a = make(settings, fake)
    assert a.health().online
    assert a.transport_info()["auth"] == "digest" and a.transport_info()["insecure"] is False


def test_forced_auth_skips_the_probe(settings, fake):
    a = make(settings, fake, auth="basic")
    assert a.health().online
    assert fake.hits == ["POST /GetDeviceInfo"]


def test_wrong_password_is_source_forbidden_and_unreachable_is_unavailable(settings, fake):
    a = pisr.ProvisionIsrAdapter("nvr-2", dataclasses.replace(settings_for(settings), nvr_password="wrong"), transport=fake.transport())
    h = a.health()
    assert not h.online and h.error == "source_forbidden"
    fake.down = True
    pisr.clear_auth_cache()
    assert make(settings, fake).health().error == "source_unavailable"


def test_refused_credentials_stop_further_logins(settings, fake):
    """Live finding 2026-10-04: every call re-tried the login after a 401 (lockout risk). Now one refusal = no login
    attempt for REFUSED_BACKOFF_S; later calls fail locally without touching the device."""
    a = pisr.ProvisionIsrAdapter("nvr-2", dataclasses.replace(settings_for(settings), nvr_password="wrong"), transport=fake.transport())
    assert a.health().error == "source_forbidden"
    sent = len(fake.hits)
    for call in (a.storage, a.list_channels, a.alarm_status, lambda: a.snapshot("1")):
        with pytest.raises(ApiError) as e:
            call()
        assert e.value.code == "source_forbidden" and e.value.details["reason"] == "credentials_refused_backoff"
    assert len(fake.hits) == sent
    pisr._monotonic, real = (lambda: real() + pisr.REFUSED_BACKOFF_S + 1), pisr._monotonic
    try:
        with pytest.raises(ApiError):
            a.storage()
        assert len(fake.hits) > sent  # after the backoff one new attempt is allowed
    finally:
        pisr._monotonic = real


def test_no_secret_in_any_error(settings, fake):
    fake.fail["GetChannelList"] = 4
    a = make(settings, fake)
    with pytest.raises(ApiError) as e:
        a.list_channels()
    text = repr(e.value.details) + e.value.user_message
    assert e.value.code == "source_forbidden"
    for secret in (HOST, USER, PASSWORD):
        assert secret not in text


def test_not_configured_is_refused_before_any_call(settings, fake):
    a = pisr.ProvisionIsrAdapter("nvr-2", dataclasses.replace(settings_for(settings), nvr_password=None), transport=fake.transport())
    with pytest.raises(ApiError) as e:
        a.list_channels()
    assert e.value.code == "source_not_configured" and fake.hits == []


# ---------------------------------------------------------------------------------------------- channels

def test_nvr_channels_with_osd_names_and_status(settings, fake):
    chans = make(settings, fake).list_channels()
    assert [(c.source_ref, c.channel, c.name, c.online) for c in chans] == [
        ("1", 1, "Entrance", True), ("2", 2, "Parking", True), ("3", 3, "ערוץ 3", False), ("4", 4, "ערוץ 4", False)]
    # an offline channel's OSD is not asked for
    assert "POST /GetImageOsdConfig/3" not in fake.hits and "POST /GetImageOsdConfig/4" not in fake.hits


def test_osd_names_can_be_turned_off(settings, fake):
    chans = make(settings, fake, osd_names=False).list_channels()
    assert chans[0].name == "ערוץ 1" and not any("GetImageOsdConfig" in h for h in fake.hits)


def test_ipc_is_one_channel_and_never_asked_for_a_channel_list(settings, fake):
    fake.kind = "ipc"
    fake.names = {1: "Gate"}
    chans = make(settings, fake).list_channels()
    assert [(c.source_ref, c.name, c.online) for c in chans] == [("1", "Gate", True)]
    assert not any("GetChannelList" in h for h in fake.hits)


def test_channel_list_quirk_items_beside_the_list_element():
    xml = """<config xmlns="http://www.ipc.com/ver10"><channelIDList type="list" count="2"/><itemType type="string"/>
    <item channelStatus="online">1</item><item channelStatus="videoLoss">7</item><item>7</item></config>"""
    assert px.parse_channel_list(xml) == [(1, "online"), (7, "videoLoss")]
    nested = """<config><channelIDList type="list" count="1"><item channelStatus="offline">2</item></channelIDList></config>"""
    assert px.parse_channel_list(nested) == [(2, "offline")]


# ---------------------------------------------------------------------------------------------- encodings

def test_read_stream_encodings_normalized(settings, fake):
    fake.codec = {2: "h265plus"}
    enc = make(settings, fake).read_stream_encodings()
    assert set(enc) == {"1", "2", "4"}  # channel 3 (offline) is refused by the device and left out
    main, sub, third = enc["1"]
    assert (main.stream_ref, main.role, sub.stream_ref, sub.role, third.role) == ("101", "main", "102", "sub", "third")
    assert main.encoding["codec"] == "H.265" and main.encoding["smart_codec"] is False and main.encoding["profile"] == "main"
    assert main.encoding["resolution"] == "2592x1520" and main.encoding["fps"] == 25.0 and main.encoding["gop"] == 50
    assert main.encoding["bitrate_mode"] == "VBR" and main.encoding["bitrate_kbps"] == 3072 and main.encoding["quality"] == 4 and main.encoding["quality_raw"] == "higher"
    assert main.encoding["svc"] is None and main.encoding["b_frames"] is None
    assert main.fields == {"svc": {"supported": False, "editable": False}, "b_frames": {"supported": False, "editable": False}}
    assert main.encoding["webrtc"] == "unknown" and main.encoding["webrtc_reason"] == "h265"
    assert sub.encoding["codec"] == "H.264" and sub.encoding["profile"] == "baseline" and sub.encoding["webrtc"] == "unknown"  # profile not trusted (live)
    assert third.encoding["codec"] == "MJPEG" and third.encoding["webrtc"] == "no" and "profile" in third.fields
    plus = enc["2"][0].encoding
    assert plus["codec"] == "H.265" and plus["smart_codec"] is True and plus["codec_plus"] is True
    assert main.etag and len(main.etag) == 16


def test_read_stream_and_options_are_read_only(settings, fake):
    a = make(settings, fake)
    snap = a.read_stream("101")
    assert snap.element.lstrip().startswith("<") and snap.parsed["stream_id"] == 1 and snap.etag == snap.parsed["etag"]
    opts = a.stream_options("102")
    assert opts.writable is False and opts.reason == "writes_disabled" and opts.write_via is None
    assert opts.options["resolution"] == {"H.264": ["704x576"], "H.265": ["704x576"], "MJPEG": ["704x576"]}
    assert opts.options["codec"] == ["H.264", "H.265", "MJPEG"] and opts.options["profile"] == {"H.264": ["baseline"]}
    assert opts.options["bitrate_list"] == [128, 256, 512, 768, 1024] and opts.options["gop"] == {"min": 6, "max": 360}
    assert opts.options["quality"] == [1, 2, 3, 4, 5] and opts.options["fps"][-1] == 25.0 and opts.options["svc"] is False
    with pytest.raises(ApiError) as e:
        a.read_stream("109")
    assert e.value.status == 404
    with pytest.raises(ApiError) as e:
        a.read_stream("abc")
    assert e.value.code == "value_not_allowed"


def test_write_is_refused_and_nothing_is_ever_written(settings, fake):
    a = make(settings, fake)
    with pytest.raises(ApiError) as e:
        a.write_stream_encoding("101", "x", "<item/>", "direct")
    assert e.value.code == "nvr_not_supported"
    with pytest.raises(ApiError) as e:
        a._call("SetVideoStreamConfig", 1, body="<config/>")  # not on the allow-list: refused before any request
    assert e.value.details["reason"] == "not_allowed"
    a.list_channels(); a.read_stream_encodings(); a.stream_options("101"); a.snapshot("1"); a.storage(); a.record_status()
    a.ports(); a.device_time(); a.alarm_status(); a.live_source("1", "main")
    assert fake.writes == []
    assert all(h.split()[1].lstrip("/").split("/")[0] in pisr.READ_COMMANDS for h in fake.hits)


# ---------------------------------------------------------------------------------------------- media

def test_live_source_nvr_query_and_path_styles(settings, fake):
    assert make(settings, fake).live_source("2", "sub") == f"rtsp://{USER}:{PASSWORD}@{HOST}:554/profile2", "discovered from GetStreamCaps"
    assert make(settings, fake, rtsp_style="query").live_source("2", "sub") == f"rtsp://{USER}:{PASSWORD}@{HOST}:554?chID=2&streamType=sub"
    assert make(settings, fake, rtsp_style="path").live_source("2", "main") == f"rtsp://{USER}:{PASSWORD}@{HOST}:554/chID=2&streamType=main"
    with pytest.raises(ApiError):
        make(settings, fake).live_source("2", "other")
    with pytest.raises(ApiError):
        make(settings, fake).live_source("../x", "main")


def test_live_source_ipc_uses_the_stream_name(settings, fake):
    fake.kind = "ipc"
    a = make(settings, fake)
    assert a.live_source("1", "main") == f"rtsp://{USER}:{PASSWORD}@{HOST}:554/profile1"
    assert a.live_source("1", "third").endswith("/profile3")


def test_live_source_escapes_credentials(settings, fake):
    # device_kind given: building an NVR's URL then needs no device call (the fake would refuse this password)
    a = pisr.ProvisionIsrAdapter("nvr-2", dataclasses.replace(settings_for(settings, device_kind="nvr", rtsp_style="path"), nvr_password="p@ss:/w"), transport=fake.transport())
    assert "p%40ss%3A%2Fw@" in a.live_source("1", "main") and fake.hits == []


def test_snapshot_jpeg_and_empty_answer(settings, fake):
    a = make(settings, fake)
    assert a.snapshot("1").startswith(b"\xff\xd8\xff")
    with pytest.raises(ApiError) as e:
        a.snapshot("3")
    assert e.value.code == "snapshot_unavailable"


# ---------------------------------------------------------------------------------------------- status reads

def test_storage_record_status_ports_time(settings, fake):
    a = make(settings, fake)
    assert a.storage() == [{"total_mb": 953869, "free_mb": 847872, "status": "read/write"}]
    rs = a.record_status()
    assert rs[1]["state"] == "recording" and rs[1]["record_types"] == ["motion"] and rs[2]["state"] == "norecording"
    p = a.ports()
    assert p["rtsp"] == 554 and p["long_polling"] == 8091 and p["long_polling_enabled"] is True
    t = a.device_time()
    assert t["current_time"] == "2026-10-04 12:00:00" and t["time_zone"].startswith("IST-2") and t["sync"] == "NTP"


def test_device_info_drops_serial_and_mac(settings, fake):
    info = make(settings, fake).device_info()
    assert info["kind"] == "nvr" and info["chl_max_count"] == 8
    flat = repr(info)
    assert "FAKESERIAL" not in flat and "00:00:5E" not in flat


def test_device_error_codes_map_to_shared_codes(settings, fake):
    a = make(settings, fake)
    for code, expected in ((1, "nvr_not_supported"), (7, "nvr_busy"), (3, "source_error"), (10, "source_forbidden")):
        fake.fail["GetDiskInfo"] = code
        with pytest.raises(ApiError) as e:
            a.storage()
        assert e.value.code == expected and e.value.details["device_code"] == code


def test_unsafe_or_broken_xml_is_source_invalid(settings, fake):
    a = make(settings, fake)
    a.health()
    fake._GetDiskInfo = lambda request, ch: fake._xml(request, '<!DOCTYPE x [<!ENTITY a "b">]><config><diskInfo/></config>')
    with pytest.raises(ApiError) as e:
        a.storage()
    assert e.value.code == "source_invalid"


def test_deadline_bounds_every_call(settings, fake):
    a = make(settings, fake)
    with nvr.deadline(0):
        with pytest.raises(ApiError) as e:
            a.storage()
    assert e.value.code == "source_timeout"


# ---------------------------------------------------------------------------------------------- events

def test_alarm_status_parses_v1_and_list_shapes():
    v1 = """<config><alarmStatusInfo><motionAlarm type="boolean" id="1">false</motionAlarm><motionAlarm type="boolean" id="2">true</motionAlarm>
    <sensorAlarmIn type="list" count="2"><itemType type="boolean"/><item id="1">false</item><item id="2">true</item></sensorAlarmIn>
    <tripwireAlarm type="boolean">false</tripwireAlarm></alarmStatusInfo></config>"""
    assert px.parse_alarm_status(v1) == {("motionAlarm", 1): False, ("motionAlarm", 2): True, ("sensorAlarmIn", 1): False,
                                         ("sensorAlarmIn", 2): True, ("tripwireAlarm", None): False}
    v2 = """<config><alarmStatusInfo><motionAlarm type="list"><item id="3">true</item></motionAlarm></alarmStatusInfo></config>"""
    assert px.parse_alarm_status(v2) == {("motionAlarm", 3): True}


def test_poll_events_edges_and_normalized_types(settings, fake):
    a = make(settings, fake)
    tracker = pisr.AlarmTracker()
    fake.alarms = {("motionAlarm", 1): True, ("motionAlarm", 2): False, ("tripwireAlarm", 2): True, ("sensorAlarmIn", 1): False}
    first = a.poll_events(tracker)
    got = {(x.raw_type, x.state, x.channel) for x in first}
    # first round: what is active now (motion 1, line 2) and channels already offline (3 offline, 4 video loss)
    assert got == {("VMD", "active", 1), ("linedetection", "active", 2), ("IPCDisconnect", "active", 3), ("IPCDisconnect", "active", 4)}
    assert {normalize_type(x)[0] for x in first} == {"motion", "line", "offline"}
    assert a.poll_events(tracker) == []  # nothing changed: no event
    fake.alarms = {("motionAlarm", 1): False, ("sensorAlarmIn", 1): True}
    fake.channels[3] = "online"
    second = {(x.raw_type, x.state, x.channel, x.raw_tags.get("input")) for x in a.poll_events(tracker)}
    assert second == {("VMD", "inactive", 1, None), ("linedetection", "inactive", 2, None), ("IO", "active", None, "1"),
                      ("IPCDisconnect", "inactive", 3, None)}


def test_ipc_alarms_without_id_are_channel_one(settings, fake):
    fake.kind = "ipc"
    fake.alarms = {("perimeterAlarm", None): True}
    alerts = make(settings, fake).poll_events(pisr.AlarmTracker())
    assert [(x.raw_type, x.channel) for x in alerts] == [("fielddetection", 1)]
    assert not any("GetChannelList" in h for h in fake.hits)


def test_unknown_alarm_kind_is_kept_as_other(settings, fake):
    fake.alarms = {("fooBarAlarm", 2): True, ("loiteringAlarm", 3): True}
    alerts = {a.raw_tags["kind"]: a for a in make(settings, fake).poll_events(pisr.AlarmTracker(), channels=False)}
    assert alerts["fooBarAlarm"].raw_type == "fooBarAlarm" and normalize_type(alerts["fooBarAlarm"])[0] == "other"
    assert alerts["loiteringAlarm"].raw_type == "loitering" and alerts["loiteringAlarm"].channel == 3


def test_pull_subscription_session(settings, fake):
    fake.kind = "ipc"
    a = make(settings, fake)
    sub = a.pull_subscription()
    opened = sub.open()
    assert opened["server_address"].endswith("subsription_1") and opened["termination_time"] == 1759575660
    fake.pull_queue = [{("motionAlarm", 1): True}, {("motionAlarm", 1): False}]
    alerts = sub.pull()
    assert [(x.raw_type, x.state, x.channel, x.device_time) for x in alerts] == [
        ("VMD", "active", 1, "2026-10-04 12:00:00"), ("VMD", "inactive", 1, "2026-10-04 12:00:01")]
    assert all("FAKESERIAL" not in repr(x.raw_tags) for x in alerts)
    sub.renew(60)
    assert sub.termination_time == 1759575720
    sub.close()
    assert sub.address is None
    assert [h for h in fake.hits if "Sub" in h or "Pull" in h or "Renew" in h] == [
        "POST /SetSubscribe", "POST /GetPullMessages", "POST /SetRenew", "POST /SetUnSubscribe"]
    assert fake.writes == []


def test_pull_subscription_refused_when_the_service_is_off(settings, fake):
    a = make(settings, fake)
    fake._GetPortConfig = lambda request, ch: fake._xml(request, '<config xmlns="http://www.ipc.com/ver10"><port><httpPort>80</httpPort><enablelongPollingHttp>false</enablelongPollingHttp></port></config>')
    with pytest.raises(ApiError) as e:
        a.pull_subscription().open()
    assert e.value.code == "nvr_not_supported"
