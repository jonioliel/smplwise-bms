"""RECORDED-DAYS-MONTH-2407: days with recordings in a local month (the legacy add-on's monthly calendar), with the NVR faked.

Covers the ISAPI dailyDistribution read (body, parse, unsupported -> fallback), the derivation from the recording search
(month boundaries in UTC, a DST month in two IANA zones, segments crossing midnight, the page cap -> partial), the empty
month, the future month (no device call), the current month (days after today never asked), Provision-ISR record dates,
the per-camera recorder (multi-NVR), the cache, permissions and validation."""
from __future__ import annotations

import datetime as dt
from dataclasses import replace

import httpx
import pytest
from conftest import as_user, bind, seed_tree
from fastapi.testclient import TestClient

from smplwise.errors import ApiError
from smplwise.main import create_app
from smplwise.services import nvr, recorded_days as rd, recordings
from smplwise.services.recorders import vendor_io
from smplwise.services.timeutil import parse_utc

from test_recordings import set_track, xml_page

DD_XML = """<?xml version="1.0" encoding="UTF-8"?>
<trackDailyDistribution version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
<dayList>
{days}
</dayList>
</trackDailyDistribution>"""


def dd_xml(recorded: set[int], ndays: int = 30) -> str:
    rows = "\n".join(
        f"<day><id>{d}</id><dayOfMonth>{d}</dayOfMonth><record>{'true' if d in recorded else 'false'}</record><recordType>time</recordType></day>"
        for d in range(1, ndays + 1)
    )
    return DD_XML.format(days=rows)


@pytest.fixture(autouse=True)
def _fresh_caches():
    rd.invalidate()
    recordings.invalidate()
    yield
    rd.invalidate()
    recordings.invalidate()


@pytest.fixture()
def lab(settings):
    s = replace(settings, nvr_host="nvr.local", nvr_user="u", nvr_password="p", go2rtc_url="http://go2rtc:1984")
    c = TestClient(create_app(s))
    cam = c.post("/api/v1/cameras", json={"channel": 1, "alias": "a"}).json()
    set_track(s, cam["id"], 101)
    return c, s, cam


def NOON(y: int, m: int, d: int) -> dt.datetime:
    """Local noon in Israel as a UTC instant (the injected 'now')."""
    return dt.datetime(y, m, d, 9, 0, tzinfo=dt.timezone.utc)


def no_search(*_a, **_k):
    raise AssertionError("the recording search must not run here")


# ------------------------------------------------------------------------------------------------ ISAPI dailyDistribution


def test_parse_daily_distribution_reads_record_flags():
    assert nvr.parse_daily_distribution(dd_xml({2, 14, 30})) == {d: d in {2, 14, 30} for d in range(1, 31)}


@pytest.mark.parametrize("xml", ["<ResponseStatus><statusCode>4</statusCode><subStatusCode>notSupport</subStatusCode></ResponseStatus>", "not xml <"])
def test_parse_daily_distribution_refuses_non_day_lists(xml):
    with pytest.raises(nvr.DailyDistributionUnsupported):
        nvr.parse_daily_distribution(xml)


def _mock_client(monkeypatch, handler):
    seen: list[httpx.Request] = []

    def transport(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return handler(request)

    monkeypatch.setattr(nvr, "_client", lambda _s, timeout=8.0: httpx.Client(base_url="http://nvr.local", transport=httpx.MockTransport(transport)))
    return seen


def test_daily_distribution_posts_the_legacy_body(monkeypatch, settings):
    seen = _mock_client(monkeypatch, lambda r: httpx.Response(200, text=dd_xml({5})))
    assert nvr.daily_distribution(settings, 101, 2026, 3)[5] is True
    req = seen[0]
    assert req.method == "POST" and req.url.path == "/ISAPI/ContentMgmt/record/tracks/101/dailyDistribution"
    body = req.content.decode()
    assert "<trackDailyParam" in body and "<year>2026</year><monthOfYear>3</monthOfYear>" in body


@pytest.mark.parametrize("status,exc", [(404, nvr.DailyDistributionUnsupported), (400, nvr.DailyDistributionUnsupported), (401, ApiError), (403, ApiError)])
def test_daily_distribution_status_handling(monkeypatch, settings, status, exc):
    _mock_client(monkeypatch, lambda r: httpx.Response(status, text="<ResponseStatus/>"))
    with pytest.raises(exc):
        nvr.daily_distribution(settings, 101, 2026, 3)


# ------------------------------------------------------------------------------------------------ the endpoint


def test_endpoint_uses_daily_distribution(lab, monkeypatch):
    client, _s, cam = lab
    calls: list[tuple[int, int, int]] = []

    def fake_dd(_settings, track_id, year, month):
        calls.append((track_id, year, month))
        return nvr.parse_daily_distribution(dd_xml({1, 9, 30}))

    monkeypatch.setattr(nvr, "daily_distribution", fake_dd)
    monkeypatch.setattr(nvr, "search_recordings", no_search)
    r = client.get(f"/api/v1/cameras/{cam['id']}/recordings/days?month=2026-09")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["days"] == ["2026-09-01", "2026-09-09", "2026-09-30"]
    assert body["source"] == "daily_distribution" and body["coverage"] == "complete"
    assert body["month"] == "2026-09" and body["timezone"] == "Asia/Jerusalem" and body["through"] == "2026-09-30"
    assert body["camera_id"] == cam["id"] and calls == [(101, 2026, 9)]


def test_empty_month_is_complete_and_empty(lab, monkeypatch):
    client, _s, cam = lab
    monkeypatch.setattr(nvr, "daily_distribution", lambda *_a: nvr.parse_daily_distribution(dd_xml(set(), 31)))
    body = client.get(f"/api/v1/cameras/{cam['id']}/recordings/days?month=2026-08").json()
    assert body["days"] == [] and body["coverage"] == "complete" and body["source"] == "daily_distribution"


def test_cache_answers_the_second_call_and_invalidate_clears_it(lab, monkeypatch):
    client, _s, cam = lab
    n = {"dd": 0}

    def fake_dd(*_a):
        n["dd"] += 1
        return {3: True}

    monkeypatch.setattr(nvr, "daily_distribution", fake_dd)
    url = f"/api/v1/cameras/{cam['id']}/recordings/days?month=2026-07"
    assert client.get(url).json()["days"] == ["2026-07-03"]
    assert client.get(url).json()["days"] == ["2026-07-03"]
    assert n["dd"] == 1, "a past month is cached"
    client.get(f"/api/v1/cameras/{cam['id']}/recordings/days?month=2026-06")
    assert n["dd"] == 2, "another month is its own key"
    rd.invalidate(cam["id"])
    client.get(url)
    assert n["dd"] == 3


def test_cache_ttl_is_short_for_the_current_month(monkeypatch, settings):
    cam = {"id": "cam1", "main_track": 101, "recorder_id": None, "channel": 1}
    monkeypatch.setattr("smplwise.recorder_scope.camera_settings", lambda s, c: s)
    n = {"dd": 0}

    def fake_dd(*_a):
        n["dd"] += 1
        return {1: True}

    monkeypatch.setattr(nvr, "daily_distribution", fake_dd)
    clock = {"t": 1_000_000.0}
    monkeypatch.setattr(rd.time, "time", lambda: clock["t"])
    today = NOON(2026, 11, 7)
    rd.days_in_month(settings, cam, "2026-11", "Asia/Jerusalem", now=today)
    clock["t"] += rd.TTL_CURRENT_S - 1
    rd.days_in_month(settings, cam, "2026-11", "Asia/Jerusalem", now=today)
    assert n["dd"] == 1
    clock["t"] += 2
    rd.days_in_month(settings, cam, "2026-11", "Asia/Jerusalem", now=today)
    assert n["dd"] == 2, "the month that holds today is re-asked after a minute"
    rd.days_in_month(settings, cam, "2026-10", "Asia/Jerusalem", now=today)
    clock["t"] += rd.TTL_CURRENT_S + 5
    rd.days_in_month(settings, cam, "2026-10", "Asia/Jerusalem", now=today)
    assert n["dd"] == 3, "a past month keeps its answer for an hour"


def test_cache_is_bounded(monkeypatch, settings):
    monkeypatch.setattr("smplwise.recorder_scope.camera_settings", lambda s, c: s)
    monkeypatch.setattr(nvr, "daily_distribution", lambda *_a: {1: True})
    for i in range(rd.CACHE_MAX + 10):
        rd.days_in_month(settings, {"id": f"c{i}", "main_track": 101, "recorder_id": None, "channel": 1}, "2026-01", "Asia/Jerusalem", now=NOON(2026, 11, 7))
    assert len(rd._cache) <= rd.CACHE_MAX


def test_current_month_stops_at_today(monkeypatch, settings):
    monkeypatch.setattr("smplwise.recorder_scope.camera_settings", lambda s, c: s)
    monkeypatch.setattr(nvr, "daily_distribution", lambda *_a: {d: True for d in range(1, 31)})
    r = rd.days_in_month(settings, {"id": "c", "main_track": 101, "recorder_id": None, "channel": 1}, "2026-11", "Asia/Jerusalem", now=NOON(2026, 11, 7))
    assert r.days == [f"2026-11-0{d}" for d in range(1, 8)] and r.through == "2026-11-07"


def test_future_month_does_not_ask_the_device(monkeypatch, settings):
    monkeypatch.setattr("smplwise.recorder_scope.camera_settings", lambda s, c: s)
    monkeypatch.setattr(nvr, "daily_distribution", no_search)
    monkeypatch.setattr(nvr, "search_recordings", no_search)
    r = rd.days_in_month(settings, {"id": "c", "main_track": 101, "recorder_id": None, "channel": 1}, "2026-12", "Asia/Jerusalem", now=NOON(2026, 11, 7))
    assert r.days == [] and r.source == "future" and r.through is None


# ------------------------------------------------------------------------------------------------ fallback: the recording search


def test_fallback_month_boundaries_and_dst_month_jerusalem(lab, monkeypatch):
    """March 2026 in Asia/Jerusalem: IST (UTC+2) until Fri 27 March 02:00, then IDT (UTC+3). The NVR is asked in its wall clock
    from 1 March 00:00 to 1 April 00:00 in windows of at most seven local days; device files map to local dates by the zone rules."""
    client, _s, cam = lab

    def unsupported(*_a):
        raise nvr.DailyDistributionUnsupported("status 404")

    windows: list[tuple[str, str]] = []
    files = {
        # wall clock (NVR) start, end
        "2026-03-01T00:00:00Z": "2026-03-01T00:10:00Z",  # the first minutes of the month (UTC: 28 Feb 22:00)
        "2026-03-26T23:50:00Z": "2026-03-27T00:20:00Z",  # crosses local midnight -> 26 and 27
        "2026-03-28T23:30:00Z": "2026-03-28T23:59:00Z",  # after the switch (UTC 20:30): still 28 March
        "2026-03-31T23:58:00Z": "2026-03-31T23:59:59Z",  # the last minutes of the month (UTC 20:58)
    }

    def fake_search(_settings, track_id, start_wall, end_wall, position=0, page_size=40, search_id=None):
        windows.append((start_wall, end_wall))
        items = [(s, e, "CMR") for s, e in files.items() if s < end_wall and e > start_wall]
        return nvr.parse_search_response(xml_page(items, "OK"), track_id)

    monkeypatch.setattr(nvr, "daily_distribution", unsupported)
    monkeypatch.setattr(nvr, "search_recordings", fake_search)
    body = client.get(f"/api/v1/cameras/{cam['id']}/recordings/days?month=2026-03").json()
    assert body["source"] == "segment_search" and body["coverage"] == "complete" and "not offered" in body["note"]
    assert body["days"] == ["2026-03-01", "2026-03-26", "2026-03-27", "2026-03-28", "2026-03-31"]
    assert windows[0][0] == "2026-03-01T00:00:00Z" and windows[-1][1] == "2026-04-01T00:00:00Z"
    assert len(windows) == 5 and all(a[1] == b[0] for a, b in zip(windows, windows[1:])), "contiguous windows, no gap at the DST switch"


def test_fallback_dst_month_new_york(monkeypatch, settings):
    """November 2026 in America/New_York: EDT (UTC-4) until Sun 1 Nov 02:00, then EST (UTC-5); the 1st has 25 hours."""
    monkeypatch.setattr("smplwise.recorder_scope.camera_settings", lambda s, c: s)
    monkeypatch.setattr(nvr, "daily_distribution", lambda *_a: {})  # a day list with no days: not trusted as "empty"
    asked: list[tuple[dt.datetime, dt.datetime]] = []

    def fake_segments(_settings, _conn, _cam, start, end, tz_name):
        asked.append((start, end))
        segs = []
        if start <= parse_utc("2026-11-01T04:00:00Z") < end:
            segs.append(recordings.Segment("2026-11-02T04:30:00Z", "2026-11-02T05:30:00Z", "continuous", 101, "", ""))  # 23:30 1 Nov -> 00:30 2 Nov EST
        return recordings.SearchResult(segs, "complete", len(segs), 1, "", tz_name)

    monkeypatch.setattr(recordings, "search_segments", fake_segments)
    r = rd.days_in_month(settings, {"id": "c", "main_track": 101, "recorder_id": None, "channel": 1}, "2026-11", "America/New_York", now=NOON(2026, 12, 1))
    assert r.days == ["2026-11-01", "2026-11-02"] and "no days" in r.note
    assert asked[0][0] == parse_utc("2026-11-01T04:00:00Z"), "local 1 Nov 00:00 EDT"
    assert asked[-1][1] == parse_utc("2026-12-01T05:00:00Z"), "local 1 Dec 00:00 EST"
    assert asked[0][1] - asked[0][0] == dt.timedelta(days=7, hours=1), "the window holding the 25-hour day"


def test_fallback_partial_when_a_window_hits_the_page_cap(lab, monkeypatch):
    client, _s, cam = lab
    monkeypatch.setattr(nvr, "daily_distribution", lambda *_a: (_ for _ in ()).throw(nvr.DailyDistributionUnsupported("status 400")))
    monkeypatch.setattr(recordings, "MAX_PAGES", 1)

    def endless(_settings, track_id, start_wall, end_wall, position=0, page_size=40, search_id=None):
        day = start_wall[:10]
        return nvr.parse_search_response(xml_page([(f"{day}T10:00:00Z", f"{day}T10:30:00Z", "CMR")], "MORE"), track_id)

    monkeypatch.setattr(nvr, "search_recordings", endless)
    body = client.get(f"/api/v1/cameras/{cam['id']}/recordings/days?month=2026-02").json()
    assert body["coverage"] == "partial" and "page cap" in body["note"]
    assert body["days"] == ["2026-02-01", "2026-02-08", "2026-02-15", "2026-02-22"]


def test_local_dates_of_segment():
    assert rd.local_dates_of("2026-03-26T21:50:00Z", "2026-03-26T22:20:00Z", "Asia/Jerusalem") == {dt.date(2026, 3, 26), dt.date(2026, 3, 27)}
    assert rd.local_dates_of("2026-03-26T20:00:00Z", "2026-03-26T22:00:00Z", "Asia/Jerusalem") == {dt.date(2026, 3, 26)}, "end is exclusive"
    assert rd.local_dates_of("2026-03-26T22:00:00Z", "2026-03-26T22:00:00Z", "Asia/Jerusalem") == set()


# ------------------------------------------------------------------------------------------------ Provision-ISR + multi-NVR


def test_provision_record_dates_filtered_to_the_month(monkeypatch, settings):
    prov = replace(settings, nvr_vendor="provision_isr")
    seen: dict = {}
    monkeypatch.setattr("smplwise.recorder_scope.camera_settings", lambda s, c: prov)

    def fake_days(s, recorder_id, channel, tz_name):
        seen.update(settings=s, recorder=recorder_id, channel=channel)
        return [dt.date(2026, 9, 30), dt.date(2026, 10, 1), dt.date(2026, 10, 4), dt.date(2026, 10, 31), dt.date(2026, 11, 1)]

    monkeypatch.setattr(vendor_io, "record_days", fake_days)
    monkeypatch.setattr(nvr, "daily_distribution", no_search)
    r = rd.days_in_month(settings, {"id": "p", "main_track": 3, "recorder_id": "rec2", "channel": 3}, "2026-10", "Asia/Jerusalem", now=NOON(2026, 11, 7))
    assert r.days == ["2026-10-01", "2026-10-04", "2026-10-31"] and r.source == "record_dates"
    assert seen == {"settings": prov, "recorder": "rec2", "channel": 3}


def test_the_camera_recorder_settings_reach_the_device_read(monkeypatch, settings):
    second = replace(settings, nvr_host="nvr-2.local")
    monkeypatch.setattr("smplwise.recorder_scope.camera_settings", lambda s, c: second if c["recorder_id"] == "rec2" else s)
    hosts: list[str | None] = []
    monkeypatch.setattr(nvr, "daily_distribution", lambda s, *_a: (hosts.append(s.nvr_host), {2: True})[1])
    rd.days_in_month(settings, {"id": "x", "main_track": 201, "recorder_id": "rec2", "channel": 2}, "2026-10", "Asia/Jerusalem", now=NOON(2026, 11, 7))
    assert hosts == ["nvr-2.local"]


# ------------------------------------------------------------------------------------------------ validation + permissions


@pytest.mark.parametrize("month", ["2026-13", "2026-1", "26-01", "", "2026-00"])
def test_month_validation(lab, month):
    client, _s, cam = lab
    assert client.get(f"/api/v1/cameras/{cam['id']}/recordings/days?month={month}").status_code == 422


def test_parse_month_range():
    with pytest.raises(ApiError):
        rd.parse_month("1999-12")
    assert rd.parse_month("2026-03") == (2026, 3)


def test_permissions_and_missing_track(lab, monkeypatch):
    client, s, cam = lab
    ids = seed_tree(client)
    bind(client, s, "ron", "viewer", "floor", ids["floor3"])
    monkeypatch.setattr(nvr, "daily_distribution", no_search)
    assert client.get(f"/api/v1/cameras/{cam['id']}/recordings/days?month=2026-10", headers=as_user("ron")).status_code == 403
    assert client.get("/api/v1/cameras/nope/recordings/days?month=2026-10").status_code in (403, 404)
    other = client.post("/api/v1/cameras", json={"channel": 7, "alias": "no-track"}).json()
    set_track(s, other["id"], 0)
    r = client.get(f"/api/v1/cameras/{other['id']}/recordings/days?month=2026-10")
    assert r.status_code == 409 and r.json()["code"] == "no_track"
