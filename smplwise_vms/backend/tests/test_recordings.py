"""Recording search (T027), TimeAdapter (T014) and playback sessions (T028) with the NVR and go2rtc faked."""
from __future__ import annotations

import datetime as dt
from dataclasses import replace

import pytest
from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import go2rtc as g2
from smplwise.services import nvr, playback as pb, recordings
from smplwise.services.timeutil import compact_wall, nvr_wall_to_utc, parse_utc, utc_to_nvr_wall, zone

TZ = zone("Asia/Jerusalem")

SEARCH_XML = """<?xml version="1.0" encoding="UTF-8"?>
<CMSearchResult version="2.0" xmlns="http://www.hikvision.com/ver20/XMLSchema">
<searchID>C77384AD-66A0-0001-E7C2-000000000001</searchID>
<responseStatus>true</responseStatus>
<responseStatusStrg>{status}</responseStatusStrg>
<numOfMatches>{n}</numOfMatches>
<matchList>
{items}
</matchList>
</CMSearchResult>"""

ITEM = """<searchMatchItem>
<sourceID>{{0000000000-0000-0000-0000-000000000000}}</sourceID>
<trackID>101</trackID>
<timeSpan><startTime>{start}</startTime><endTime>{end}</endTime></timeSpan>
<mediaSegmentDescriptor><contentType>video</contentType><codecType>H.264-BP</codecType>
<playbackURI>rtsp://nvr.local:90/Streaming/tracks/101/?starttime={s2}&amp;endtime={e2}&amp;name=ch01_0000{i}&amp;size=1000</playbackURI>
</mediaSegmentDescriptor>
<metadataMatches><metadataDescriptor>recordType.meta.hikvision.com/{kind}</metadataDescriptor></metadataMatches>
</searchMatchItem>"""


def xml_page(items: list[tuple[str, str, str]], status: str = "OK") -> str:
    body = "\n".join(ITEM.format(start=s, end=e, s2=s.replace("-", "").replace(":", ""), e2=e.replace("-", "").replace(":", ""), i=i, kind=k) for i, (s, e, k) in enumerate(items))
    return SEARCH_XML.format(status=status, n=len(items), items=body)


def test_time_adapter_israel_dst():
    # 2026-09-14 is Israel Daylight Time (UTC+3): the NVR wall clock is 3 h ahead of UTC.
    utc = parse_utc("2026-09-14T07:28:12Z")
    assert utc_to_nvr_wall(utc, TZ) == "2026-09-14T10:28:12Z"
    assert nvr_wall_to_utc("2026-09-14T10:28:12Z", TZ) == utc
    assert compact_wall(utc, TZ) == "20260914T102812Z"
    # winter: UTC+2
    assert utc_to_nvr_wall(parse_utc("2026-12-01T07:00:00Z"), TZ) == "2026-12-01T09:00:00Z"
    with pytest.raises(ValueError):
        parse_utc("2026-09-14T07:28:12")  # naive timestamps are refused


def test_parse_search_response_and_merge():
    page = nvr.parse_search_response(xml_page([("2026-09-14T10:00:00Z", "2026-09-14T10:30:00Z", "CMR"), ("2026-09-14T10:30:00Z", "2026-09-14T11:00:00Z", "CMR"), ("2026-09-14T11:30:00Z", "2026-09-14T11:31:00Z", "MOTION")], "MORE"), 101)
    assert page.status == "MORE" and page.total == 3 and [m.record_type for m in page.matches] == ["CMR", "CMR", "MOTION"]
    assert page.matches[0].playback_uri.startswith("rtsp://nvr.local:90/Streaming/tracks/101/?starttime=20260914T100000Z")
    segs = [recordings.Segment(start_at=f"2026-09-14T{h}:00Z", end_at=f"2026-09-14T{e}:00Z", kind=k, track_id=101, start_raw="", end_raw="") for h, e, k in [("07:00", "07:30", "continuous"), ("07:30", "08:00", "continuous"), ("08:30", "08:31", "motion")]]
    merged = recordings.merge(segs)
    assert [(s.start_at, s.end_at, s.kind) for s in merged] == [("2026-09-14T07:00:00Z", "2026-09-14T08:00:00Z", "continuous"), ("2026-09-14T08:30:00Z", "2026-09-14T08:31:00Z", "motion")]


def _camera_with_track(client: TestClient, channel: int = 1) -> dict:
    cam = client.post("/api/v1/cameras", json={"channel": channel, "alias": f"c{channel}"}).json()
    from smplwise.db import Database

    return cam


@pytest.fixture()
def lab_client(settings, monkeypatch):
    """App with NVR/go2rtc configured but both faked."""
    s = replace(settings, nvr_host="nvr.local", nvr_user="u", nvr_password="p", go2rtc_url="http://go2rtc:1984")
    c = TestClient(create_app(s))
    return c, s


def set_track(settings, camera_id: str, track: int = 101) -> None:
    from smplwise.db import Database

    db = Database(settings.db_path)
    with db.connection() as conn:
        conn.execute("UPDATE cameras SET main_track = ? WHERE id = ?", (track, camera_id))


def test_recordings_endpoint_converts_local_day_and_reports_coverage(lab_client, monkeypatch):
    client, s = lab_client
    recordings.invalidate()
    cam = client.post("/api/v1/cameras", json={"channel": 1, "alias": "a"}).json()
    set_track(s, cam["id"])
    calls: list[tuple[str, str, int]] = []

    def fake_search(_settings, track_id, start_wall, end_wall, position=0, page_size=40, search_id=None):
        calls.append((start_wall, end_wall, position))
        if position == 0:
            return nvr.parse_search_response(xml_page([("2026-09-14T00:00:00Z", "2026-09-14T06:00:00Z", "CMR"), ("2026-09-14T06:00:00Z", "2026-09-14T12:00:00Z", "CMR")], "MORE"), track_id)
        return nvr.parse_search_response(xml_page([("2026-09-14T13:00:00Z", "2026-09-14T13:02:00Z", "MOTION")], "OK"), track_id)

    monkeypatch.setattr(nvr, "search_recordings", fake_search)
    r = client.get(f"/api/v1/cameras/{cam['id']}/recordings?date=2026-09-14").json()
    # local day 2026-09-14 (IDT) = 2026-09-13T21:00Z … 2026-09-14T21:00Z; the NVR is asked in wall clock
    assert r["from"] == "2026-09-13T21:00:00Z" and r["to"] == "2026-09-14T21:00:00Z"
    assert calls[0][:2] == ("2026-09-14T00:00:00Z", "2026-09-15T00:00:00Z") and calls[1][2] == 40
    assert r["coverage"] == "complete" and r["pages"] == 2 and r["matches"] == 3
    assert [(x["start_at"], x["end_at"], x["kind"]) for x in r["segments"]] == [
        ("2026-09-13T21:00:00Z", "2026-09-14T09:00:00Z", "continuous"),
        ("2026-09-14T10:00:00Z", "2026-09-14T10:02:00Z", "motion"),
    ]
    assert r["timezone"] == "Asia/Jerusalem"
    # cached: a second call does not hit the NVR again
    n = len(calls)
    client.get(f"/api/v1/cameras/{cam['id']}/recordings?date=2026-09-14")
    assert len(calls) == n


def test_recordings_partial_when_page_cap_reached(lab_client, monkeypatch):
    client, s = lab_client
    recordings.invalidate()
    cam = client.post("/api/v1/cameras", json={"channel": 2, "alias": "b"}).json()
    set_track(s, cam["id"], 201)
    monkeypatch.setattr(recordings, "MAX_PAGES", 2)

    def endless(_settings, track_id, start_wall, end_wall, position=0, page_size=40, search_id=None):
        h = 10 + position // 40
        return nvr.parse_search_response(xml_page([(f"2026-09-14T{h:02d}:00:00Z", f"2026-09-14T{h:02d}:30:00Z", "CMR")], "MORE"), track_id)

    monkeypatch.setattr(nvr, "search_recordings", endless)
    r = client.get(f"/api/v1/cameras/{cam['id']}/recordings?from=2026-09-14T06:00:00Z&to=2026-09-14T12:00:00Z").json()
    assert r["coverage"] == "partial" and r["pages"] == 2 and "page cap" in r["note"]


def test_recordings_permissions(lab_client, monkeypatch):
    client, s = lab_client
    ids = seed_tree(client)
    cam = client.post("/api/v1/cameras", json={"channel": 3, "alias": "c"}).json()
    set_track(s, cam["id"], 301)
    bind(client, s, "ron", "viewer", "floor", ids["floor3"])
    assert client.get(f"/api/v1/cameras/{cam['id']}/recordings?date=2026-09-14", headers=as_user("ron")).status_code == 403
    assert client.get(f"/api/v1/cameras/{cam['id']}/recordings", headers=as_user("joni")).status_code == 422


class FakeGo2rtc:
    store: dict[str, list[str]] = {}
    deleted: list[str] = []

    def __init__(self, *a, **k):
        pass

    def list_streams(self):
        return {n: g2.StreamInfo(name=n, sources=list(v), online=False) for n, v in self.store.items()}

    def ensure_stream(self, name, src):
        assert name.startswith("smplwise_")
        created = name not in self.store
        self.store[name] = [src]
        return "created" if created else "updated"

    def delete_stream(self, name):
        assert name.startswith("smplwise_")
        self.store.pop(name, None)
        self.deleted.append(name)

    def ws_url(self, name):
        return f"ws://go2rtc:1984/api/ws?src={name}"

    def ws_headers(self):
        return {}

    def info(self):
        return {"version": "fake"}


def test_playback_session_lifecycle(lab_client, monkeypatch):
    client, s = lab_client
    recordings.invalidate()
    pb.REGISTRY.sessions.clear()
    pb.set_instance_id("t1")
    FakeGo2rtc.store = {"hik_cam1": ["rtsp://x"], "pb_1700000000": ["rtsp://legacy"], "smplwise_pb_t1_dead_g0": ["rtsp://old"], "smplwise_pb_other_x_g0": ["rtsp://other-instance"]}
    FakeGo2rtc.deleted = []
    monkeypatch.setattr(pb.g2, "Go2rtc", FakeGo2rtc)
    cam = client.post("/api/v1/cameras", json={"channel": 1, "alias": "a"}).json()
    set_track(s, cam["id"])

    def fake_search(_settings, track_id, start_wall, end_wall, position=0, page_size=40, search_id=None):
        return nvr.parse_search_response(xml_page([("2026-09-14T09:00:00Z", "2026-09-14T12:00:00Z", "CMR")], "OK"), track_id)

    monkeypatch.setattr(nvr, "search_recordings", fake_search)
    # startup sweep removes only our orphan, never legacy pb_* or other names
    removed = pb.sweep_orphans(s)
    assert removed == ["smplwise_pb_t1_dead_g0"] and "pb_1700000000" in FakeGo2rtc.store and "hik_cam1" in FakeGo2rtc.store
    assert "smplwise_pb_other_x_g0" in FakeGo2rtc.store, "another instance's playback streams are never touched"

    r = client.post("/api/v1/playback/sessions", json={"camera_id": cam["id"], "start_at": "2026-09-14T07:00:00Z"})
    assert r.status_code == 201, r.text
    sess = r.json()
    assert sess["generation"] == 0 and sess["state"] == "buffering" and sess["time_precision"] == "keyframe_limited" and sess["media_anchor"] is None
    assert sess["media_handle"] == f"api/v1/playback/sessions/{sess['id']}/ws?generation=0" and sess["moved_to_next_segment"] is False
    name0 = pb.stream_name(sess["id"], 0)
    src = FakeGo2rtc.store[name0][0]
    # 07:00Z = 10:00 wall clock; the request ends where the segment ends (12:00 wall clock), local compact format
    assert src == "rtsp://u:p@nvr.local:554/Streaming/tracks/101?starttime=20260914T100000Z&endtime=20260914T120000Z", src
    # a request inside a gap moves to the next segment and says so
    r2 = client.post("/api/v1/playback/sessions", json={"camera_id": cam["id"], "start_at": "2026-09-14T05:00:00Z"})
    assert r2.status_code == 201 and r2.json()["moved_to_next_segment"] is True and r2.json()["requested_at"] == "2026-09-14T06:00:00Z"
    # nothing within six hours → 409 no_recording
    r3 = client.post("/api/v1/playback/sessions", json={"camera_id": cam["id"], "start_at": "2026-09-13T20:00:00Z"})
    assert r3.status_code == 409 and r3.json()["code"] == "no_recording"
    # seek = new generation, old stream deleted
    r4 = client.post(f"/api/v1/playback/sessions/{sess['id']}/seek", json={"start_at": "2026-09-14T08:00:00Z"})
    assert r4.status_code == 200 and r4.json()["generation"] == 1 and name0 in FakeGo2rtc.deleted
    assert pb.stream_name(sess["id"], 1) in FakeGo2rtc.store
    # stale generation socket is refused with 4410
    from starlette.websockets import WebSocketDisconnect

    with pytest.raises((WebSocketDisconnect, Exception)):
        with client.websocket_connect(f"/api/v1/playback/sessions/{sess['id']}/ws?generation=0"):
            pass
    # another user cannot touch it
    bind(client, s, "ron", "viewer", "installation", "*")
    assert client.get(f"/api/v1/playback/sessions/{sess['id']}", headers=as_user("ron")).status_code == 403
    # close deletes the stream
    assert client.delete(f"/api/v1/playback/sessions/{sess['id']}").json()["state"] == "closed"
    assert pb.stream_name(sess["id"], 1) in FakeGo2rtc.deleted and pb.stream_name(sess["id"], 1) not in FakeGo2rtc.store
    # quota: cap 1 → second concurrent session refused (the gap-session from above is closed first)
    client.delete(f"/api/v1/playback/sessions/{r2.json()['id']}")
    client.patch("/api/v1/settings", json={"playback.max_sessions": 1})
    a = client.post("/api/v1/playback/sessions", json={"camera_id": cam["id"], "start_at": "2026-09-14T07:00:00Z"})
    b = client.post("/api/v1/playback/sessions", json={"camera_id": cam["id"], "start_at": "2026-09-14T07:00:00Z"})
    assert a.status_code == 201 and b.status_code == 429
    # idle expiry via the janitor deletes the stream
    session = pb.REGISTRY.sessions[a.json()["id"]]
    session.last_activity -= 10_000
    assert pb.expire_idle(s, 600) == [session.id] and session.state == "expired" and session.stream == ""
