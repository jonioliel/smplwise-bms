"""T074: time to recording / time to seek on the playback socket, and the live line's answer time (docs/changes/T074-VISUAL-METRICS-2405.md).

The NVR and go2rtc are faked (test_recordings.FakeGo2rtc); the relay is replaced by a coroutine that hands the route two media chunks,
so the route's own `on_down` measures the first media byte against the generation's request. The audit row and the log line carry
numbers only, and scripts/gate/video_timing.py reads exactly what the route writes.
"""
from __future__ import annotations

import contextlib
import json
import logging
import sys
from dataclasses import replace
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from test_recordings import FakeGo2rtc, set_track, xml_page

from smplwise.main import create_app
from smplwise.routers import playback as pbr
from smplwise.services import nvr, playback as pb, recordings

GATE = Path(__file__).resolve().parents[3] / "scripts" / "gate"
if str(GATE) not in sys.path:
    sys.path.insert(0, str(GATE))

import video_timing as vt  # noqa: E402


def _relay(chunks: list[int], reason: str = "upstream_closed"):
    async def relay(websocket, upstream_url, headers, on_down, should_stop=None, stop_event=None, close_timeout=None, on_text=None):
        for n in chunks:
            on_down(n)
        return reason

    return relay


@pytest.fixture()
def pb_client(settings, monkeypatch):
    s = replace(settings, nvr_host="nvr.local", nvr_user="u", nvr_password="p", go2rtc_url="http://go2rtc:1984")
    c = TestClient(create_app(s))
    recordings.invalidate()
    pb.REGISTRY.sessions.clear()
    pb.set_instance_id("t074")
    FakeGo2rtc.store, FakeGo2rtc.deleted = {}, []
    monkeypatch.setattr(pb.g2, "Go2rtc", FakeGo2rtc)
    monkeypatch.setattr(pbr.g2, "Go2rtc", FakeGo2rtc)
    monkeypatch.setattr(nvr, "search_recordings", lambda _s, track_id, *a, **k: nvr.parse_search_response(
        xml_page([("2026-09-14T09:00:00Z", "2026-09-14T12:00:00Z", "CMR")], "OK"), track_id))
    monkeypatch.setattr(pbr, "relay_ws", _relay([1200, 800]))
    cam = c.post("/api/v1/cameras", json={"channel": 1, "alias": "a"}).json()
    set_track(s, cam["id"])
    yield c, s, cam
    pb.REGISTRY.sessions.clear()


def _socket(c: TestClient, sid: str, gen: int) -> None:
    with c.websocket_connect(f"/api/v1/playback/sessions/{sid}/ws?generation={gen}") as ws:
        with contextlib.suppress(Exception):
            ws.receive_text()


def _stop_rows(s) -> list[dict]:
    from smplwise.db import Database

    with Database(s.db_path).connection(mode="read") as conn:
        return [json.loads(r["details_json"]) for r in conn.execute("SELECT details_json FROM audit_log WHERE action = 'video.playback.stop' ORDER BY rowid")]


def test_start_and_seek_are_timed_from_their_request_to_the_first_media_byte(pb_client, caplog):
    c, s, cam = pb_client
    sess = c.post("/api/v1/playback/sessions", json={"camera_id": cam["id"], "start_at": "2026-09-14T07:00:00Z"}).json()
    session = pb.REGISTRY.sessions[sess["id"]]
    assert session.first_media_ms is None and session.gen_media_ms is None
    session.gen_started -= 1.5        # the start request was 1.5 s ago
    with caplog.at_level(logging.INFO, logger="smplwise.playback"):
        _socket(c, sess["id"], 0)
    assert 1500 <= session.first_media_ms < 60_000 and session.gen_media_ms == session.first_media_ms
    assert session.seek_media_ms == []
    line = next(r.getMessage() for r in caplog.records if "socket closed" in r.getMessage())
    assert f"g0 socket closed: upstream_closed (2000 bytes, first media {session.first_media_ms} ms)" in line

    r = c.post(f"/api/v1/playback/sessions/{sess['id']}/seek", json={"start_at": "2026-09-14T08:00:00Z"})
    assert r.status_code == 200 and r.json()["generation"] == 1
    assert session.gen_media_ms is None, "a seek starts a new measurement"
    session.gen_started -= 0.75
    _socket(c, sess["id"], 1)
    assert session.first_media_ms >= 1500, "the start measurement is kept"
    assert len(session.seek_media_ms) == 1 and 750 <= session.seek_media_ms[0] < 60_000

    assert c.delete(f"/api/v1/playback/sessions/{sess['id']}").status_code == 200
    stop = _stop_rows(s)[-1]
    assert stop["first_media_ms"] == session.first_media_ms and stop["seek_media_ms"] == session.seek_media_ms
    # numbers only: the row names no stream, URL or address
    assert not any(x in json.dumps(stop) for x in ("rtsp", "nvr.local", "smplwise_pb", "go2rtc"))

    # the same row read back by the metric script
    col = vt.Collector()
    vt.add_audit_rows(col, [{"action": "video.playback.stop", "details": stop}], "audit-json")
    smp = col.samples()
    assert smp["playback.start.first_media_ms"] == [session.first_media_ms] and smp["playback.seek.first_media_ms"] == session.seek_media_ms


def test_a_session_closed_before_any_media_writes_null_and_counts_as_no_media(pb_client):
    c, s, cam = pb_client
    sess = c.post("/api/v1/playback/sessions", json={"camera_id": cam["id"], "start_at": "2026-09-14T07:00:00Z"}).json()
    assert c.post(f"/api/v1/playback/sessions/{sess['id']}/close").status_code == 200   # the beacon path
    stop = _stop_rows(s)[-1]
    assert "first_media_ms" in stop and stop["first_media_ms"] is None and "seek_media_ms" not in stop and stop["via"] == "beacon"
    col = vt.Collector()
    vt.add_audit_rows(col, [{"action": "video.playback.stop", "details": stop}], "audit-json")
    assert col.ratios()["playback.no_media_ratio"] == {"no_media": 1, "total": 1, "ratio": 1.0}


def test_note_first_media_counts_once_per_generation_and_ignores_a_superseded_socket():
    s = pb.PlaybackSession(id="x", camera_id="c", channel=1, track_id=101, user_id="u", username="u", requested_at=None, end_at=None,
                           stream="", tz_name="UTC")
    s.gen_started = 100.0
    assert pb.note_first_media(s, 0, now=100.4) == 400 and s.first_media_ms == 400
    assert pb.note_first_media(s, 0, now=105.0) is None and s.first_media_ms == 400, "once per generation"
    for g in range(1, pb.SEEK_MEDIA_KEEP + 6):
        s.generation, s.gen_media_ms, s.gen_started = g, None, 200.0
        assert pb.note_first_media(s, g - 1, now=201.0) is None, "a byte of the previous generation measures nothing"
        assert pb.note_first_media(s, g, now=200.0 + g) == g * 1000
    assert len(s.seek_media_ms) == pb.SEEK_MEDIA_KEEP and s.seek_media_ms[-1] == (pb.SEEK_MEDIA_KEEP + 5) * 1000
    assert pb.media_timing(s) == {"first_media_ms": 400, "seek_media_ms": s.seek_media_ms}


def test_the_live_line_carries_the_answer_time_and_the_metric_script_reads_it():
    """The format string of routers/media.py, rendered as logging renders it, parsed by video_timing.py (WebRTC and MSE)."""
    import inspect

    from smplwise.routers import media

    src = inspect.getsource(media._live_relay)
    fmt = "live session %s ended: %s (transport %s, first media %s ms, answer %s ms)"
    assert fmt in src, "keep the prefix stable: scripts/gate/video_timing.py parses this line"
    col = vt.Collector()
    for line in (fmt % ("a1", "client_closed", "webrtc", "-", 240), fmt % ("b2", "client_closed", "mse", 1830, "-"),
                 fmt % ("c3", "upstream_failure", "-", "-", "-"), "live session d4 ended: client_closed (transport mse, first media 900 ms)"):
        m = vt.LIVE_RE.search(line)
        assert m, line
        col.live_session(m["sid"], m["transport"], m["ttff"], m["answer"])
    smp = col.samples()
    assert smp["live.webrtc.answer_ms"] == [240] and sorted(smp["live.mse.first_media_ms"]) == [900, 1830]
    assert col.ratios()["live.no_media_ratio"] == {"no_media": 1, "total": 4, "ratio": 0.25}
