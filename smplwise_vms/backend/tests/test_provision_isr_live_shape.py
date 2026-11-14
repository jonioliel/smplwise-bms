"""CR-025: the adapter against the shapes the owner's NVR really answered (2026-10-04, read-only session; model
NVR8-16400AN, firmware 1.4.7, 16 channels). The fake reproduces them with invented values (`fake.shape = "live"`); the
redacted captures stay in private-evidence/provision-isr-live/ until reviewed. Every test here pins a divergence from
the vendor guide that the first live run found."""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

from smplwise.services.recorders import provision_isr as pisr
from smplwise.services.recorders import provision_isr_xml as px

sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from fake_provision import HOST, PASSWORD, USER, FakeProvision, settings_for  # noqa: E402


@pytest.fixture()
def fake() -> FakeProvision:
    pisr.clear_auth_cache()
    f = FakeProvision()
    f.shape = "live"
    f.names = {1: "DI-320IPSN-28-V2", 2: "I2-320IPSN-28-V2", 3: "Lobby", 4: "Yard"}
    return f


def make(settings, fake, **extra) -> pisr.ProvisionIsrAdapter:
    return pisr.ProvisionIsrAdapter("nvr-2", settings_for(settings, **extra), transport=fake.transport())


def test_zero_based_stream_ids_map_to_main_and_sub(settings, fake):
    """Live: `<item id="0">` is the main stream, id 1 the sub. Before the fix id 0 was dropped and the SUB stream was
    reported as 101 (main)."""
    enc = make(settings, fake).read_stream_encodings()["1"]
    main, sub, third = enc
    assert (main.stream_ref, main.role, main.encoding["resolution"]) == ("101", "main", "2592x1520")
    assert (sub.stream_ref, sub.role, sub.encoding["resolution"]) == ("102", "sub", "704x576")
    assert third.role == "third"


def test_stream_names_carrying_the_device_url_are_never_kept(settings, fake):
    snap = make(settings, fake).read_stream("101")
    assert snap.parsed["name"] is None and snap.parsed["url_path"] == "/chID=1&streamType=main"
    assert HOST not in repr({k: v for k, v in snap.parsed.items() if k != "element"})


def test_live_source_takes_the_path_from_the_device(settings, fake):
    a = make(settings, fake)
    assert a.live_source("2", "main") == f"rtsp://{USER}:{PASSWORD}@{HOST}:554/chID=2&streamType=main"
    assert a.live_source("2", "sub") == f"rtsp://{USER}:{PASSWORD}@{HOST}:554/chID=2&streamType=sub1", "the live sub is sub1, not sub"


def test_channel_names_come_from_the_list_without_osd_calls(settings, fake):
    chans = make(settings, fake).list_channels()
    assert [(c.channel, c.name, c.online) for c in chans][:3] == [(1, "DI-320IPSN-28-V2", True), (2, "I2-320IPSN-28-V2", True), (3, "Lobby", False)]
    assert not any("GetImageOsdConfig" in h for h in fake.hits)


def test_record_status_aggregates_streams_and_reads_no_recording(settings, fake):
    rs = make(settings, fake).record_status()
    assert rs[1]["state"] == "norecording"
    assert rs[2]["state"] == "recording" and rs[2]["streams"] == ["main", "sub"] and rs[2]["record_types"] == ["manual", "motion"]


def test_profiles_from_the_top_level_caps_and_empty_codec_caps(settings, fake):
    caps = make(settings, fake).stream_caps(1)
    assert caps["streams"][1]["profiles"] == ["baseline", "main"] and caps["streams"][1]["codecs"] == []
    assert caps["streams"][1]["device_id"] == 0 and caps["streams"][2]["url_path"] == "/chID=1&streamType=sub1"


def test_native_channel_offline_alarm_is_not_duplicated(settings, fake):
    fake.channels = {1: "online", 2: "online", 3: "offline", 4: "online"}
    fake.alarms = {("motionAlarm", 2): True}
    alerts = make(settings, fake).poll_events(pisr.AlarmTracker())
    got = sorted((a.raw_type, a.state, a.channel) for a in alerts)
    assert got == [("IPCDisconnect", "active", 3), ("VMD", "active", 2)], "one offline event, from the device's own chlOfflineAlarm"
    assert not any("GetChannelList" in h for h in fake.hits[-1:])


def test_write_uses_the_device_id_of_the_stream(settings, fake):
    a = make(settings, fake, writes_enabled=True)
    snap = a.read_stream("101")
    item = a.stream_document(snap.element, {"bitrate_kbps": 4096})
    assert item.startswith('<item id="0">')
    out = a.write_stream_encoding("101", snap.etag, item, "direct")
    assert out.verified.parsed["bitrate_kbps"] == 4096 and a.read_stream("102").parsed["bitrate_kbps"] == 512
    assert '<item id="0">' in fake.set_bodies[0] and '<item id="1">' in fake.set_bodies[0]
    assert "rtsp://" not in fake.set_bodies[0], "the URL-shaped name is never sent back"


def test_device_info_without_api_version_is_v1(settings, fake):
    info = make(settings, fake).device_info()
    assert info["api_version"] is None and info["kind"] == "nvr"


def test_url_path_alphabet_is_strict():
    assert px.stream_url_path("rtsp://h:554/chID=1&streamType=main") == "/chID=1&streamType=main"
    assert px.stream_url_path("rtsp://h:554/a b") is None and px.stream_url_path("rtsp://h/x;rm") is None
    assert px.stream_url_path("profile1") is None
