"""CR-025 P3: Provision-ISR recording search, calendar, playback RTSP requests, snapshot at a time and export source
(services/recorders/provision_playback.py) against `FakeProvisionPlayback`, which reproduces what the owner's NVR answered
in the read-only session of 2026-10-04 (1000-item cap oldest first, clipping to the window, errorCode 3 for "nothing",
unpadded dates, image/h264 key frames, 1-based playback chID)."""
from __future__ import annotations

import dataclasses
import datetime as dt
import shutil
import sys
from pathlib import Path

import pytest

from smplwise.errors import ApiError
from smplwise.services import playback as pb
from smplwise.services.recorders import provision_isr as pisr
from smplwise.services.recorders import provision_playback as pp
from smplwise.services.recorders import provision_time as pt

sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from fake_provision import HOST, PASSWORD, USER, settings_for  # noqa: E402
from fake_provision_playback import H264_KEYFRAME, FakeProvisionPlayback, motion_day  # noqa: E402

UTC = dt.timezone.utc


def u(*a: int) -> dt.datetime:
    return dt.datetime(*a, tzinfo=UTC)


@pytest.fixture()
def fake() -> FakeProvisionPlayback:
    pisr.clear_auth_cache()
    pp.clear_caches()
    f = FakeProvisionPlayback()
    f.shape = "live"
    return f


def make(settings, fake, tz_name="Asia/Jerusalem", **extra) -> pp.ProvisionPlayback:
    return pp.ProvisionPlayback(pisr.ProvisionIsrAdapter("nvr-2", settings_for(settings, **extra), transport=fake.transport()), tz_name)


# ------------------------------------------------------------------------------------------------ search

def test_search_maps_device_segments_to_arx_segments(settings, fake):
    fake.recordings = {8: [("2026-10-04 12:48:37", 36, "motion"), ("2026-10-04 12:50:30", 51, "motion"), ("2026-10-04 13:00:00", 600, "schedule"),
                           ("2026-10-04 13:20:00", 30, "sensor"), ("2026-10-04 13:30:00", 20, "intel detection")]}
    res = make(settings, fake).search(8, u(2026, 10, 4, 9, 0), u(2026, 10, 4, 11, 0))
    assert res.coverage == "complete" and res.pages == 1 and res.matches == 5
    assert [(s.start_at, s.end_at, s.kind) for s in res.segments] == [
        ("2026-10-04T09:48:37Z", "2026-10-04T09:49:13Z", "motion"),
        ("2026-10-04T09:50:30Z", "2026-10-04T09:51:21Z", "motion"),
        ("2026-10-04T10:00:00Z", "2026-10-04T10:10:00Z", "continuous"),
        ("2026-10-04T10:20:00Z", "2026-10-04T10:20:30Z", "alarm"),
        ("2026-10-04T10:30:00Z", "2026-10-04T10:30:20Z", "event"),
    ]
    first = res.segments[0]
    assert (first.track_id, first.start_raw, first.end_raw) == (8, "2026-10-04 12:48:37", "2026-10-04 12:48:37+36s"), "raw device strings kept"
    assert res.timezone == "device:IST-2IDT,M3.5.5/2,M10.5.0/2"
    body = fake.search_bodies[0]
    assert "<![CDATA[2026-10-04 12:00:00]]>" in body and "<![CDATA[2026-10-04 14:00:00]]>" in body, "UTC window sent as device wall clock"
    assert fake.writes == []


def test_search_by_kind_sends_only_the_device_names_for_it(settings, fake):
    fake.recordings = {1: [("2026-10-04 10:00:00", 60, "motion"), ("2026-10-04 10:05:00", 60, "schedule"), ("2026-10-04 10:10:00", 60, "sensor")]}
    pbk = make(settings, fake)
    res = pbk.search(1, u(2026, 10, 4, 6, 0), u(2026, 10, 4, 8, 0), kinds=["continuous", "alarm"])
    assert [s.kind for s in res.segments] == ["continuous", "alarm"]
    assert "<item><![CDATA[schedule]]></item>" in fake.search_bodies[-1] and "motion" not in fake.search_bodies[-1]
    res = pbk.search(1, u(2026, 10, 4, 6, 0), u(2026, 10, 4, 8, 0), kinds=["motion"])
    assert [s.kind for s in res.segments] == ["motion"]
    with pytest.raises(ApiError) as exc:
        pbk.search(1, u(2026, 10, 4, 6, 0), u(2026, 10, 4, 8, 0), kinds=["bogus"])
    assert exc.value.code == "validation"


def test_v2_type_names_are_used_when_the_device_lists_them(settings, fake):
    fake.record_types = ["manual", "schedule", "motion", "sensor", "intelligentDetection"]
    fake.recordings = {1: [("2026-10-04 10:00:00", 60, "intelligentDetection")]}
    res = make(settings, fake).search(1, u(2026, 10, 4, 6, 0), u(2026, 10, 4, 8, 0), kinds=["event"])
    assert [s.kind for s in res.segments] == ["event"]
    assert "intelligentDetection" in fake.search_bodies[-1] and "intel detection" not in fake.search_bodies[-1]


def test_device_without_get_record_type_gets_the_v1_names(settings, fake):
    fake.record_type_missing = True
    fake.recordings = {1: [("2026-10-04 10:00:00", 60, "motion")]}
    assert len(make(settings, fake).search(1, u(2026, 10, 4, 6, 0), u(2026, 10, 4, 8, 0)).segments) == 1
    assert "intel detection" in fake.search_bodies[-1]


def test_kind_the_device_does_not_record_answers_empty_without_a_search(settings, fake):
    fake.record_types = ["motion"]
    res = make(settings, fake).search(1, u(2026, 10, 4, 6, 0), u(2026, 10, 4, 8, 0), kinds=["continuous"])
    assert res.segments == [] and res.coverage == "complete" and fake.search_bodies == []


def test_empty_window_is_errorcode_3_and_means_no_recordings(settings, fake):
    """Live: SearchByTime over a window without recordings answers HTTP 400 errorCode 3, not an empty list."""
    res = make(settings, fake).search(1, u(2026, 9, 10, 0, 0), u(2026, 9, 11, 0, 0))
    assert res.segments == [] and res.coverage == "complete" and res.pages == 1


def test_device_cap_is_paged_by_cursor_and_overlapping_pieces_are_merged(settings, fake, monkeypatch):
    """Live: count=1000 on a 3-day window, oldest first. The search continues from the end of the last item; a piece that
    comes back clipped at a page start (overlapping recordings) is merged with the rest of its recording."""
    monkeypatch.setattr(pp, "DEVICE_CAP", 4)
    fake.max_items = 4
    fake.recordings = {2: motion_day("2026-10-04", "10:00:00", count=10, seconds=60, gap=30)}
    fake.recordings[2][4] = ("2026-10-04 10:06:00", 200, "motion")  # overlaps the next two recordings
    res = make(settings, fake).search(2, u(2026, 10, 4, 6, 0), u(2026, 10, 4, 9, 0))
    assert res.coverage == "complete" and res.pages == 3 and res.matches == 10
    assert [(s.start_at[11:19], s.end_at[11:19]) for s in res.segments] == [
        ("07:00:00", "07:01:00"), ("07:01:30", "07:02:30"), ("07:03:00", "07:04:00"), ("07:04:30", "07:05:30"),
        ("07:06:00", "07:10:00"), ("07:10:30", "07:11:30"), ("07:12:00", "07:13:00"), ("07:13:30", "07:14:30")]
    starts = [b.split("<starttime")[1][:60] for b in fake.search_bodies]
    assert "09:00:00" in starts[0] and "10:05:30" in starts[1] and "10:11:30" in starts[2], "each page starts where the last item ended"


def test_request_cap_reports_partial_never_empty(settings, fake, monkeypatch):
    monkeypatch.setattr(pp, "MAX_REQUESTS", 2)
    monkeypatch.setattr(pp, "DEVICE_CAP", 3)
    fake.max_items = 3
    fake.recordings = {2: motion_day("2026-10-04", "10:00:00", count=20)}
    res = make(settings, fake).search(2, u(2026, 10, 4, 6, 0), u(2026, 10, 4, 9, 0))
    assert res.coverage == "partial" and res.pages == 2 and len(res.segments) == 6 and "request cap" in res.note


def test_segments_are_clipped_to_the_utc_window(settings, fake):
    fake.recordings = {1: [("2026-10-04 09:59:00", 600, "motion")]}
    res = make(settings, fake).search(1, u(2026, 10, 4, 7, 0), u(2026, 10, 4, 7, 5))
    assert [(s.start_at, s.end_at) for s in res.segments] == [("2026-10-04T07:00:00Z", "2026-10-04T07:05:00Z")]


@pytest.mark.parametrize("start,end,code", [
    (u(2026, 10, 4, 8), u(2026, 10, 4, 8), "validation"),
    (u(2026, 10, 1), u(2026, 10, 9), "validation"),
    (dt.datetime(2026, 10, 4, 8), dt.datetime(2026, 10, 4, 9), "validation"),
])
def test_search_window_validation(settings, fake, start, end, code):
    with pytest.raises(ApiError) as exc:
        make(settings, fake).search(1, start, end)
    assert exc.value.code == code and fake.search_bodies == []


@pytest.mark.parametrize("bad", [0, -1, "1; rm", "x", None, 513, True])
def test_bad_channel_refused_before_any_request(settings, fake, bad):
    with pytest.raises(ApiError) as exc:
        make(settings, fake).search(bad, u(2026, 10, 4, 6), u(2026, 10, 4, 7))
    assert exc.value.code == "value_not_allowed" and fake.hits == []


def test_search_refused_credentials_stop_after_one_attempt(settings, fake):
    fake.recordings = {1: [("2026-10-04 10:00:00", 60, "motion")]}
    p = pp.ProvisionPlayback(pisr.ProvisionIsrAdapter("nvr-2", dataclasses.replace(settings_for(settings), nvr_password="wrong"), transport=fake.transport()))
    for _ in range(3):
        with pytest.raises(ApiError) as exc:
            p.search(1, u(2026, 10, 4, 6), u(2026, 10, 4, 8))
        assert exc.value.code == "source_forbidden"
    authed = [h for h in fake.hits if h != "POST /GetDeviceInfo"]
    assert len(authed) <= 1, f"one refused login, then local refusals only: {fake.hits}"


def test_device_down_is_source_unavailable(settings, fake):
    fake.down = True
    with pytest.raises(ApiError) as exc:
        make(settings, fake).search(1, u(2026, 10, 4, 6), u(2026, 10, 4, 7))
    assert exc.value.code == "source_unavailable"
    assert HOST not in repr(exc.value.details) and PASSWORD not in repr(exc.value.details)


# ------------------------------------------------------------------------------------------------ time zone / DST

def test_time_basis_iana_skips_the_device_rule(settings, fake):
    fake.recordings = {1: [("2028-03-28 12:00:00", 60, "motion")]}
    dev = make(settings, fake).search(1, u(2028, 3, 28, 0), u(2028, 3, 29, 0))
    pp.clear_caches()
    ian = make(settings, fake, time_basis="iana").search(1, u(2028, 3, 28, 0), u(2028, 3, 29, 0))
    assert dev.segments[0].start_at == "2028-03-28T10:00:00Z", "the device stamps with its own rule (still IST that week)"
    assert ian.segments[0].start_at == "2028-03-28T09:00:00Z" and ian.timezone == "Asia/Jerusalem"


def test_zone_report_lists_divergence_from_iana(settings, fake):
    rep = make(settings, fake).zone_report(2028)
    assert rep["source"] == "device" and rep["device_rule"] == "IST-2IDT,M3.5.5/2,M10.5.0/2"
    assert rep["differs"] == [{"from": "2028-03-24T00:00:00Z", "to": "2028-03-31T00:00:00Z"}]
    assert make(settings, fake).zone_report(2026)["differs"] == []


def test_zone_falls_back_to_iana_when_the_clock_read_fails(settings, fake):
    fake.fail["GetDateAndTime"] = 1
    tz, source = make(settings, fake).zone()
    assert source == "iana" and str(tz) == "Asia/Jerusalem"


def test_device_with_dst_switched_off_uses_standard_time(settings, fake):
    fake.daylight = False
    fake.recordings = {1: [("2026-07-01 12:00:00", 60, "motion")]}
    res = make(settings, fake).search(1, u(2026, 7, 1, 0), u(2026, 7, 2, 0))
    assert res.segments[0].start_at == "2026-07-01T10:00:00Z"


def test_spring_forward_day_search(settings, fake):
    """2026-03-27: 02:00 IST jumps to 03:00 IDT. A recording across the jump keeps its real duration."""
    fake.recordings = {1: [("2026-03-27 01:59:00", 120, "motion"), ("2026-03-27 03:10:00", 60, "motion")]}
    res = make(settings, fake).day(1, dt.date(2026, 3, 27))
    assert [(s.start_at, s.end_at) for s in res.segments] == [("2026-03-26T23:59:00Z", "2026-03-27T00:01:00Z"), ("2026-03-27T00:10:00Z", "2026-03-27T00:11:00Z")]


def test_fall_back_day_search_places_the_repeated_hour(settings, fake):
    """2026-10-25: 02:00 IDT goes back to 01:00 IST. The device lists both passes in time order (v1: no endtime)."""
    fake.recordings = {1: [("2026-10-25 01:20:00", 1800, "motion"), ("2026-10-25 01:10:00", 300, "motion"), ("2026-10-25 02:30:00", 60, "motion")]}
    res = make(settings, fake).day(1, dt.date(2026, 10, 25))
    assert [s.start_at for s in res.segments] == ["2026-10-24T22:20:00Z", "2026-10-24T23:10:00Z", "2026-10-25T00:30:00Z"]
    assert "placed by assumption" in res.note and "widened" in res.note


def test_fall_back_v2_end_times_remove_the_guess(settings, fake):
    """v2 shape: 01:50 + 600 s ending at 02:00 wall can only be the second (IST) pass; the first would end at 01:00."""
    fake.with_endtime = True
    fake.recordings = {1: [("2026-10-25 01:50:00", 600, "motion")]}
    res = make(settings, fake).search(1, u(2026, 10, 24, 22, 0), u(2026, 10, 25, 1, 0))
    assert [s.start_at for s in res.segments] == ["2026-10-24T23:50:00Z"] and "assumption" not in res.note


def test_fall_back_inside_the_repeated_hour_stays_flagged_even_with_end_times(settings, fake):
    fake.with_endtime = True
    fake.recordings = {1: [("2026-10-25 01:30:00", 600, "motion")]}  # 01:30-01:40 exists on both passes
    res = make(settings, fake).search(1, u(2026, 10, 24, 22, 0), u(2026, 10, 25, 1, 0))
    assert [s.start_at for s in res.segments] == ["2026-10-24T22:30:00Z"] and "1 segment(s) in the repeated DST hour" in res.note


def test_day_length_follows_dst(settings, fake):
    p = make(settings, fake)
    fake.recordings = {1: [("2026-10-25 00:00:00", 25 * 3600, "schedule")]}
    res = p.day(1, dt.date(2026, 10, 25))
    s, e = res.segments[0].start_at, res.segments[0].end_at
    assert (s, e) == ("2026-10-24T21:00:00Z", "2026-10-25T22:00:00Z"), "the 25-hour day"


# ------------------------------------------------------------------------------------------------ calendar

def test_record_days_reads_unpadded_dates(settings, fake):
    fake.recordings = {3: [("2026-9-19 10:00:00", 60, "motion"), ("2026-10-4 10:00:00", 60, "motion"), ("2026-10-04 11:00:00", 60, "motion")]}
    assert make(settings, fake).record_days(3) == [dt.date(2026, 9, 19), dt.date(2026, 10, 4)]


def test_record_days_without_recordings_is_empty(settings, fake):
    assert make(settings, fake).record_days(5) == []


def test_parsers_tolerate_doc_and_live_shapes():
    doc = ('<?xml version="1.0" encoding="UTF-8"?><config version="2.0.0" xmlns="http://www.ipc.com/ver10"><timesectionList maxCount="500" count="2">'
           '<item><starttime type="string" seconds="827" recType="schedule">\n <![CDATA[2024-09-30 07:39:36]]>\n</starttime>'
           '<endtime type="string"><![CDATA[2024-09-30 07:53:23]]></endtime></item>'
           '<item><starttime seconds="x" recType="motion">2024-09-30 07:54:03</starttime></item>'
           '<item><starttime seconds="5" recType="motion"></starttime></item></timesectionList></config>')
    page = pp.parse_time_sections(doc)
    assert page.sections == [pt.Section("2024-09-30 07:39:36", 827, "schedule", "2024-09-30 07:53:23")]
    assert (page.count, page.max_count, page.truncated) == (2, 500, False)
    with pytest.raises(Exception):
        pp.parse_time_sections('<!DOCTYPE x [<!ENTITY a "b">]><config/>')
    assert pp.parse_record_dates('<config><dateList count="2"><item><![CDATA[2014-01-09]]></item><item>bad</item><item>2026-9-1</item></dateList></config>') == [
        dt.date(2014, 1, 9), dt.date(2026, 9, 1)]


def test_thousand_items_parse_past_the_generic_list_cap():
    items = "".join(f'<item><starttime seconds="10" recType="motion"><![CDATA[2026-10-01 {i // 3600:02d}:{i // 60 % 60:02d}:{i % 60:02d}]]></starttime></item>' for i in range(1000))
    page = pp.parse_time_sections(f'<config><timesectionList type="list" count="1000">{items}</timesectionList></config>')
    assert len(page.sections) == 1000 and page.truncated


def test_search_document_refuses_injection():
    with pytest.raises(ValueError):
        pp.search_document(["motion]]><x>"], dt.datetime(2026, 1, 1), dt.datetime(2026, 1, 2))


# ------------------------------------------------------------------------------------------------ playback URL

def test_playback_request_is_the_live_validated_form(settings, fake):
    req = make(settings, fake).playback_request(8, u(2026, 10, 4, 17, 17, 42), u(2026, 10, 4, 17, 18, 12))
    assert req.url == f"rtsp://{USER}:{PASSWORD}@{HOST}:554/chID=8&date=2026-10-04&time=20:17:42&timelen=30&streamType=main&action=playback"
    assert (req.timelen_s, req.wall_date, req.wall_time, req.ambiguous) == (30, "2026-10-04", "20:17:42", False)
    assert PASSWORD not in repr(req), "the URL is not in the repr"
    sub = make(settings, fake).playback_request(8, u(2026, 10, 4, 17, 17, 42), u(2026, 10, 4, 17, 18, 12), stream="sub", action="backup")
    assert sub.url.endswith("streamType=sub&action=backup"), "playback takes `sub` (the live stream's `sub1` is not needed)"


def test_playback_request_caps_span_and_escapes_credentials(settings, fake):
    s = dataclasses.replace(settings_for(settings), nvr_user="a@b", nvr_password="p:w/d?#")
    s = dataclasses.replace(s, nvr_extra={"time_basis": "iana"})  # no device call: the URL is built offline
    p = pp.ProvisionPlayback(pisr.ProvisionIsrAdapter("nvr-2", s, transport=fake.transport()))
    req = p.playback_request(1, u(2026, 10, 4, 0), u(2026, 10, 5, 0))
    assert req.timelen_s == 6 * 3600 and req.end_at == u(2026, 10, 4, 6)
    assert "rtsp://a%40b:p%3Aw%2Fd%3F%23@" in req.url
    assert p.playback_request(1, u(2026, 10, 4, 0)).timelen_s == 6 * 3600, "no end = the maximum span"
    assert fake.hits == []
    assert p.playback_request(1, u(2026, 10, 4, 0, 0, 0), u(2026, 10, 4, 0, 0, 0) + dt.timedelta(milliseconds=300)).timelen_s == 1


def test_playback_channel_base_switch_for_firmwares_that_count_from_zero(settings, fake):
    req = make(settings, fake, playback_channel_base=0).playback_request(8, u(2026, 10, 4, 10), u(2026, 10, 4, 10, 1))
    assert "/chID=7&" in req.url and req.channel == 8


@pytest.mark.parametrize("kw", [{"stream": "sub1"}, {"stream": "third"}, {"action": "delete"}])
def test_playback_request_refuses_unknown_values(settings, fake, kw):
    with pytest.raises(ApiError):
        make(settings, fake).playback_request(1, u(2026, 10, 4, 10), u(2026, 10, 4, 11), **kw)


def test_playback_request_in_the_repeated_hour_is_flagged(settings, fake):
    req = make(settings, fake).playback_request(1, u(2026, 10, 24, 23, 30), u(2026, 10, 24, 23, 40))
    assert req.wall_time == "01:30:00" and req.ambiguous


def test_media_anchor_is_the_first_recorded_instant_after_the_request(settings, fake):
    """Live: a request starting in a gap began with the next recording (PTS 0 = its start) and kept the gaps in PTS."""
    fake.recordings = {8: [("2026-10-04 12:48:37", 36, "motion"), ("2026-10-04 12:50:30", 51, "motion")]}
    res = make(settings, fake).search(8, u(2026, 10, 4, 9, 0), u(2026, 10, 4, 10, 0))
    assert pp.media_anchor(res, u(2026, 10, 4, 9, 49, 30)) == u(2026, 10, 4, 9, 50, 30)
    assert pp.media_anchor(res, u(2026, 10, 4, 9, 48, 40)) == u(2026, 10, 4, 9, 48, 40), "inside a recording = the request"
    assert pp.media_anchor(res, u(2026, 10, 4, 9, 55)) is None


def test_go2rtc_session_through_the_existing_engine_stays_in_the_namespace(settings, fake, monkeypatch):
    """The playback session engine (services/playback.py) with the Provision URL builder swapped in: the go2rtc stream is
    `smplwise_pb_*`, its source is the Provision playback URL, seek = new generation, close deletes only our stream."""
    from fake_devices import GO2RTC_HOST, FakeDevices

    devices = FakeDevices()
    devices.go2rtc["foreign"] = ["door_station_1"]
    devices.install(monkeypatch)
    fake.install(monkeypatch)
    s = dataclasses.replace(settings_for(settings), go2rtc_url=f"http://{GO2RTC_HOST}:1984")
    monkeypatch.setattr(pb, "playback_rtsp_url", pp.rtsp_playback_url)
    sources: list[str] = []
    real_ensure = pb.g2.Go2rtc.ensure_stream

    def ensure(self, name, src, check=None):
        sources.append(src)
        return real_ensure(self, name, src, check)

    monkeypatch.setattr(pb.g2.Go2rtc, "ensure_stream", ensure)

    class P:
        user_id, username = "dev-joni", "joni"

    cam = {"id": "cam-p8", "channel": 8, "main_track": 8}
    start = u(2026, 10, 4, 9, 50, 30)
    session = pb.create(s, P(), cam, start, start + dt.timedelta(minutes=5), "Asia/Jerusalem", 4)
    try:
        assert session.stream.startswith("smplwise_pb_") and sources[-1].endswith("/chID=8&date=2026-10-04&time=12:50:30&timelen=300&streamType=main&action=playback#video=copy") and sources[-1].startswith("ffmpeg:rtsp://")  # wiring: go2rtc plays this NVR through ffmpeg
        pb.seek(s, session, start + dt.timedelta(minutes=1), start + dt.timedelta(minutes=5))
        assert session.generation == 1 and "time=12:51:30&timelen=240" in sources[-1]
    finally:
        pb.close(s, session)
        pb.REGISTRY.sessions.pop(session.id, None)
    g2_writes = [w for w in devices.writes if w.startswith("go2rtc")]
    assert g2_writes and all("smplwise_pb_" in w for w in g2_writes), g2_writes
    assert "door_station_1" not in " ".join(devices.writes) and fake.writes == []


# ------------------------------------------------------------------------------------------------ snapshot at a time

def test_snapshot_at_returns_the_h264_key_frame(settings, fake):
    fake.recordings = {8: [("2026-10-04 20:17:42", 36, "motion")]}
    snap = make(settings, fake).snapshot_at(8, u(2026, 10, 4, 17, 17, 44))
    assert (snap.codec, snap.content_type, snap.data) == ("h264", "image/h264", H264_KEYFRAME)


def test_snapshot_at_jpeg_passes_through(settings, fake):
    fake.snapshot_kind = "jpeg"
    fake.recordings = {1: [("2026-10-04 10:00:00", 60, "motion")]}
    snap = make(settings, fake).snapshot_at(1, u(2026, 10, 4, 7, 0, 10))
    assert snap.codec == "jpeg" and pp.to_jpeg(snap) == snap.data


def test_snapshot_in_a_gap_is_no_recording(settings, fake):
    fake.recordings = {1: [("2026-10-04 10:00:00", 60, "motion")]}
    with pytest.raises(ApiError) as exc:
        make(settings, fake).snapshot_at(1, u(2026, 10, 4, 8, 0))
    assert exc.value.status == 404 and exc.value.code == "no_recording"


def test_to_jpeg_without_ffmpeg_is_a_clear_error(settings, fake, monkeypatch):
    monkeypatch.setattr(pp.shutil, "which", lambda _n: None)
    snap = pp.SnapshotAt(data=H264_KEYFRAME, content_type="image/h264", codec="h264", requested_at=u(2026, 10, 4))
    with pytest.raises(ApiError) as exc:
        pp.to_jpeg(snap)
    assert exc.value.code == "snapshot_unavailable" and exc.value.details["reason"] == "ffmpeg_missing"


@pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg not installed")
def test_to_jpeg_decodes_a_real_h264_key_frame(tmp_path):
    """A real Annex-B key frame (made by the local ffmpeg, not taken from a camera) decodes to a JPEG."""
    import subprocess

    raw = tmp_path / "k.h264"
    subprocess.run([shutil.which("ffmpeg"), "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=size=320x240:rate=1",
                    "-frames:v", "1", "-c:v", "libx264", "-bsf:v", "h264_mp4toannexb", "-f", "h264", str(raw)], check=True, timeout=60)
    snap = pp.SnapshotAt(data=raw.read_bytes(), content_type="image/h264", codec="h264", requested_at=u(2026, 10, 4))
    assert pp.to_jpeg(snap, width=160).startswith(b"\xff\xd8")


def test_codec_sniffing():
    assert pp._codec(b"\xff\xd8\xff\xe0", "application/octet-stream") == "jpeg"
    assert pp._codec(b"\x00\x00\x00\x01\x40\x01", "application/octet-stream") == "h265"
    assert pp._codec(b"\x00\x00\x00\x01\x67", "") == "h264"
    assert pp._codec(b"<html>", "text/html") == "unknown"


# ------------------------------------------------------------------------------------------------ export

def test_export_files_are_rtsp_backup_requests_per_recording(settings, fake):
    fake.recordings = {2: [("2026-10-04 10:00:00", 60, "motion"), ("2026-10-04 10:01:00", 60, "motion"), ("2026-10-04 11:00:00", 30, "motion")]}
    files, coverage = make(settings, fake).export_files(2, u(2026, 10, 4, 6, 0), u(2026, 10, 4, 9, 0), stream="sub")
    assert coverage == "complete"
    assert [(f.start_at, f.end_at) for f in files] == [("2026-10-04T07:00:00Z", "2026-10-04T07:02:00Z"), ("2026-10-04T08:00:00Z", "2026-10-04T08:00:30Z")]
    assert files[0].playback_uri.endswith("chID=2&date=2026-10-04&time=10:00:00&timelen=120&streamType=sub&action=backup")
    assert PASSWORD not in repr(files[0]) and files[0].name == "ch2_2026-10-04_100000"


def test_rtsp_download_refuses_non_backup_uris_and_missing_ffmpeg(settings, tmp_path, monkeypatch):
    with pytest.raises(ApiError):
        pp.rtsp_download(settings, "rtsp://h/chID=1&action=playback", tmp_path / "x.ts", ffmpeg="ffmpeg")
    monkeypatch.setattr(pp.shutil, "which", lambda _n: None)
    with pytest.raises(ApiError) as exc:
        pp.rtsp_download(settings, "rtsp://h/chID=1&action=backup", tmp_path / "x.ts")
    assert exc.value.code == "export_unavailable"


def test_rtsp_download_redacts_secrets_from_ffmpeg_errors(settings, tmp_path, monkeypatch):
    s = settings_for(settings)
    uri = f"rtsp://{USER}:{PASSWORD}@{HOST}:554/chID=1&date=2026-10-04&time=10:00:00&timelen=60&streamType=sub&action=backup"

    class Proc:
        returncode = 1

        def __init__(self, args, **kw):
            assert args[args.index("-i") + 1] == uri and "-c" in args and "copy" in args

        def poll(self):
            return 1

        def communicate(self, timeout=None):
            return b"", f"{uri}: 401 Unauthorized for {USER} at {HOST}".encode()

        def kill(self):
            pass

    monkeypatch.setattr(pp.subprocess, "Popen", Proc)
    with pytest.raises(ApiError) as exc:
        pp.rtsp_download(s, uri, tmp_path / "x.ts", ffmpeg="ffmpeg")
    text = repr(exc.value.details)
    assert exc.value.code == "download_refused" and PASSWORD not in text and USER not in text and HOST not in text


def test_rtsp_download_cancel_kills_ffmpeg_and_removes_the_file(settings, tmp_path, monkeypatch):
    killed = []

    class Proc:
        returncode = None

        def __init__(self, args, **kw):
            Path(args[-1]).write_bytes(b"x" * 10)

        def poll(self):
            return None if not killed else -9

        def communicate(self, timeout=None):
            return b"", b""

        def kill(self):
            killed.append(1)

    monkeypatch.setattr(pp.subprocess, "Popen", Proc)
    dest = tmp_path / "x.ts"
    with pytest.raises(ApiError) as exc:
        pp.rtsp_download(settings, "rtsp://h/chID=1&action=backup", dest, lambda n: False, ffmpeg="ffmpeg", poll_s=0)
    assert exc.value.code == "export_cancelled" and killed and not dest.exists()


# ------------------------------------------------------------------------------------------------ read-only guarantee

def test_every_playback_method_leaves_the_device_unwritten(settings, fake):
    fake.recordings = {1: motion_day("2026-10-04", "10:00:00", count=3)}
    p = make(settings, fake)
    p.search(1, u(2026, 10, 4, 6), u(2026, 10, 4, 9))
    p.record_days(1)
    p.day(1, dt.date(2026, 10, 4))
    p.snapshot_at(1, u(2026, 10, 4, 7, 0, 5))
    p.playback_request(1, u(2026, 10, 4, 7), u(2026, 10, 4, 8))
    p.export_files(1, u(2026, 10, 4, 6), u(2026, 10, 4, 9))
    p.zone_report(2026)
    sent = {h.split()[1].split("/")[1] for h in fake.hits}
    assert sent <= pp.PLAYBACK_COMMANDS | {"GetDeviceInfo"}, sent
    assert fake.writes == []


def test_playback_commands_do_not_widen_the_adapter_allow_list(settings, fake):
    """The adapter's own methods still refuse playback commands: the extra allow-list is per call, from this module."""
    a = pisr.ProvisionIsrAdapter("nvr-2", settings_for(settings), transport=fake.transport())
    with pytest.raises(ApiError) as exc:
        a._call("SearchByTime", 1, body="<config/>")
    assert exc.value.details["reason"] == "not_allowed"
    assert "SetVideoStreamConfig" not in pp.PLAYBACK_COMMANDS and all(c.startswith(("Get", "Search")) for c in pp.PLAYBACK_COMMANDS)
