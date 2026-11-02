"""PLAYBACK-SCRUB-2341 (docs/changes/PLAYBACK-SCRUB-2341.md): fast scrubbing in recorded playback.

Frames: the nearest picture inside the recording (not a 404 for every second without a keyframe), 404 only when no recording lies
within +-30 s, 503 (retryable, not a long negative cache) when the recorder holds the picture but did not hand it over, recent pictures
from memory, one grab per picture at a time, at most two grabs at once and no unbounded queue behind them.
Seeks: one per session at a time, a per-session cap per minute (429 seek_rate, Hebrew), and a strict order - the old generation's relay
socket closes its go2rtc socket before the old stream is deleted, and only then is the new stream created.
Pins: the native networking packages of the add-on image are exact versions; the Dockerfile ENV block is well formed."""
from __future__ import annotations

import asyncio
import datetime as dt
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace

import pytest

from conftest import seed_tree
from fastapi import WebSocket
from fastapi.testclient import TestClient

from smplwise.errors import ApiError
from smplwise.main import create_app
from smplwise.routers import frames
from smplwise.services import playback as pb

UTC = dt.timezone.utc
T0 = dt.datetime(2026, 11, 1, 17, 0, 0, tzinfo=UTC)
ADDON = Path(__file__).resolve().parents[2]


def at(seconds: float) -> dt.datetime:
    return T0 + dt.timedelta(seconds=seconds)


def iso(t: dt.datetime) -> str:
    return t.strftime("%Y-%m-%dT%H:%M:%SZ")


# ------------------------------------------------------------------------------------------------ nearest-frame search (pure)

def test_nearest_inside_a_segment_is_the_second_itself_then_ten_seconds_on():
    c = frames.nearest_candidates([(at(0), at(300))], at(125))
    assert [x[0] for x in c] == [at(125), at(135)]
    near_end = frames.nearest_candidates([(at(0), at(300))], at(295))
    assert [x[0] for x in near_end] == [at(295), at(285)], "at the segment end the second try goes back, never past the recording"


def test_nearest_in_a_gap_is_the_closest_segment_edge_within_the_window():
    segs = [(at(0), at(100)), (at(160), at(400))]
    after_first = frames.nearest_candidates(segs, at(110))
    assert after_first[0][0] == at(100 - frames.EDGE_OUT_S) and after_first[0][1:] == (at(0), at(100))
    before_second = frames.nearest_candidates(segs, at(150))
    assert before_second[0][0] == at(160 + frames.EDGE_IN_S), "10 s before the next segment: its first second, not the old one 50 s back"
    assert all(abs((c - at(150)).total_seconds()) <= frames.SEARCH_WINDOW_S + 0.5 for c, _, _ in before_second)


def test_nearest_is_empty_only_without_recording_in_the_window():
    assert frames.nearest_candidates([(at(0), at(100))], at(131)) == []
    assert frames.nearest_candidates([], at(10)) == []
    assert frames.nearest_candidates([(at(200), at(100))], at(150)) == [], "a malformed segment is ignored"
    assert frames.nearest_candidates([(at(0), at(100))], at(126)), "the edge picture (97 s) lies within 30 s: offered"


def test_nearest_never_offers_two_candidates_of_the_same_bucket():
    c = frames.nearest_candidates([(at(0), at(5)), (at(6), at(9))], at(7))
    keys = [frames.bucket_key(x[0]) for x in c]
    assert len(keys) == len(set(keys))


def test_search_window_is_aligned_and_covers_thirty_seconds_each_side():
    for s in (0, 31, 299, 570, 599):
        lo, hi = frames.search_window(at(s))
        assert lo <= at(s - 30) and hi >= at(s + 30)
        assert int(lo.timestamp()) % frames.SEARCH_ALIGN_S == 0 and int(hi.timestamp()) % frames.SEARCH_ALIGN_S == 0
    assert frames.search_window(at(100)) == frames.search_window(at(200)), "hovering along the timeline asks the same cached question"


def test_frame_memo_is_bounded_per_camera_and_in_cameras():
    m = frames.FrameMemo(per_camera=3, cameras=2)
    for i in range(5):
        m.put("a", f"k{i}", b"x", "t")
    assert m.get("a", "k0") is None and m.get("a", "k4") == (b"x", "t")
    m.put("a", "k9", b"y", "t9", asked="asked1")
    assert m.get("a", "asked1") == (b"y", "t9"), "an asked bucket resolves to the picture that answered it"
    m.put("b", "k", b"b", "t")
    m.put("c", "k", b"c", "t")
    assert m.get("a", "k9") is None, "least recently used camera dropped"
    m.mark_failed("c", "z")
    assert m.failed_recently("c", "z") and not m.failed_recently("c", "other")


# --------------------------------------------------------------------------------------------------------- frame endpoint

class _Seg:
    def __init__(self, s: dt.datetime, e: dt.datetime) -> None:
        self.start_at, self.end_at = iso(s), iso(e)


@pytest.fixture
def frame_app(settings, monkeypatch):
    frames.MEMO.clear()
    app = create_app(replace(settings, nvr_host="nvr.example", nvr_user="u", nvr_password="p"))
    c = TestClient(app)
    seed_tree(c)
    cam = c.post("/api/v1/cameras", json={"channel": 1, "alias": "Scrub"}).json()
    with app.state.db.connection() as conn:
        conn.execute("UPDATE cameras SET main_track = 1401 WHERE id = ?", (cam["id"],))
    rig = SimpleNamespace(c=c, cam=cam["id"], segments=[(at(0), at(100)), (at(160), at(400))], searches=0, grabs=[], fail_starts=set(), delay=0.0)

    def fake_search(_settings, _conn, _cam, lo, hi, _tz):
        rig.searches += 1
        return SimpleNamespace(segments=[_Seg(s, e) for s, e in rig.segments if e > lo and s < hi])

    def fake_grab(url, out, _s, timeout_s=40):
        m = re.search(r"starttime=(\w+)", url)
        rig.grabs.append(m.group(1) if m else url)
        if rig.delay:
            time.sleep(rig.delay)
        if out.stem in rig.fail_starts:
            return False
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(b"\xff\xd8" + out.stem.encode() + b"\xff\xd9")
        return True

    monkeypatch.setattr(frames, "SEARCH", fake_search)
    monkeypatch.setattr(frames, "GRAB", fake_grab)
    yield rig
    frames.MEMO.clear()


def _get(rig, t: dt.datetime):
    return rig.c.get(f"/api/v1/cameras/{rig.cam}/frame?at={iso(t)}")


def test_a_second_without_a_picture_gets_the_nearest_one_instead_of_404(frame_app):
    rig = frame_app
    r = _get(rig, at(117))  # in the gap after the first segment: 17 s past its end
    assert r.status_code == 200 and r.content.startswith(b"\xff\xd8")
    assert r.headers["X-Frame-At"] == iso(at(90)), "the bucket of the segment's last seconds (97 s)"
    assert r.headers["X-Frame-Asked"] == iso(at(117))
    n = len(rig.grabs)
    assert _get(rig, at(117)).status_code == 200 and len(rig.grabs) == n, "the same asked second: from memory, no grab"
    assert _get(rig, at(119)).status_code == 200 and len(rig.grabs) == n, "the same asked bucket resolves through the memo"


def test_404_only_when_no_recording_lies_within_thirty_seconds(frame_app):
    rig = frame_app
    r = _get(rig, at(131))  # 31 s past the first segment's end, 29 s before the next one: the next one answers
    assert r.status_code == 200 and r.headers["X-Frame-At"] == iso(at(160))
    rig.segments = [(at(0), at(100))]
    frames.MEMO.clear()
    r = _get(rig, at(141))
    assert r.status_code == 404 and "frame_unavailable" in r.text
    n = len(rig.grabs)
    assert _get(rig, at(142)).status_code == 404 and len(rig.grabs) == n, "no recording: negative-cached, never grabbed"


def test_recording_there_but_not_handed_over_is_503_not_404_and_not_hammered(frame_app):
    rig = frame_app
    rig.fail_starts = {frames.bucket_key(at(50)), frames.bucket_key(at(60))}
    r = _get(rig, at(55))
    assert r.status_code == 503, r.text
    assert len(rig.grabs) == 2, "the asked second, then one more try 10 s on"
    r2 = _get(rig, at(55))
    assert r2.status_code == 503 and len(rig.grabs) == 2, "a failed picture is not asked again for RETRY_TTL_S"
    rig.fail_starts = {frames.bucket_key(at(50))}
    frames.MEMO.clear()  # the retry window is over
    r3 = _get(rig, at(55))
    assert r3.status_code == 200 and r3.headers["X-Frame-At"] == iso(at(60)), "the second try answers with its own instant"


def test_search_unavailable_falls_back_to_the_asked_second(frame_app, monkeypatch):
    rig = frame_app

    def down(*a, **k):
        raise ApiError(503, "nvr_unreachable", "x")

    monkeypatch.setattr(frames, "SEARCH", down)
    r = _get(rig, at(42))
    assert r.status_code == 200 and r.headers["X-Frame-At"] == iso(at(40)) and len(rig.grabs) == 1


def test_concurrent_requests_for_one_picture_grab_once_and_at_most_two_at_once(frame_app):
    rig = frame_app
    rig.delay = 0.15
    with ThreadPoolExecutor(max_workers=6) as pool:
        codes = list(pool.map(lambda _i: _get(rig, at(212)).status_code, range(6)))
    assert codes == [200] * 6
    assert len(rig.grabs) == 1, f"single flight: one grab for six identical hovers, saw {rig.grabs}"
    live, peak, lock = [0], [0], threading.Lock()
    real = frames.GRAB

    def counting(url, out, s, timeout_s=40):
        with lock:
            live[0] += 1
            peak[0] = max(peak[0], live[0])
        try:
            return real(url, out, s, timeout_s)
        finally:
            with lock:
                live[0] -= 1

    frames.GRAB = counting
    try:
        with ThreadPoolExecutor(max_workers=8) as pool:
            codes = list(pool.map(lambda i: _get(rig, at(170 + i * 20)).status_code, range(8)))
    finally:
        frames.GRAB = real
    assert set(codes) <= {200, 503} and codes.count(200) >= 6
    assert peak[0] <= 2, f"at most two grabs at once, saw {peak[0]}"


def test_no_free_grab_slot_is_503_frame_busy_instead_of_a_queue(frame_app, monkeypatch):
    rig = frame_app
    monkeypatch.setattr(frames, "GRAB_SLOT_WAIT_S", 0.1)
    assert frames._sem.acquire(timeout=1) and frames._sem.acquire(timeout=1)
    try:
        r = _get(rig, at(250))
    finally:
        frames._sem.release()
        frames._sem.release()
    assert r.status_code == 503 and "נסה שוב" in r.text
    assert _get(rig, at(250)).status_code == 200, "a busy slot is not remembered as a failure"


# --------------------------------------------------------------------------------------------------------------- seek rate

def _bare_session() -> pb.PlaybackSession:
    return pb.PlaybackSession(id="s1", camera_id="cam", channel=1, track_id=101, user_id="u", username="u", requested_at=T0, end_at=at(3600), stream="smplwise_pb_s1_g0", tz_name="Asia/Jerusalem")


def test_seek_rate_cap_per_session_per_minute():
    s = _bare_session()
    for i in range(5):
        pb.check_seek_rate(s, 5, now=1000 + i)
    with pytest.raises(ApiError) as exc:
        pb.check_seek_rate(s, 5, now=1010)
    e = exc.value
    assert e.status == 429 and e.code == "seek_rate" and "קפיצות" in e.user_message and e.details["retry_after_s"] == 51
    assert len(s.seek_times) == 5, "a refused seek is not counted"
    pb.check_seek_rate(s, 5, now=1061)  # the first one left the minute
    for _ in range(100):
        pb.check_seek_rate(s, 0, now=1062)  # 0 = no cap
    assert pb.seek_retry_after(_bare_session(), None) is None


def test_seek_rate_setting_default_and_bounds(settings):
    with TestClient(create_app(settings)) as c:
        assert c.get("/api/v1/settings").json()["settings"]["playback.max_seeks_per_min"] == 30
        assert c.patch("/api/v1/settings", json={"playback.max_seeks_per_min": 0}).status_code == 200
        assert c.patch("/api/v1/settings", json={"playback.max_seeks_per_min": 600}).status_code == 200
        assert c.patch("/api/v1/settings", json={"playback.max_seeks_per_min": 601}).status_code == 422
        assert c.patch("/api/v1/settings", json={"playback.max_seeks_per_min": -1}).status_code == 422


# ---------------------------------------------------------------------------------------------------------- seek ordering

class _P:
    user_id = "dev-joni"
    username = "joni"


@pytest.fixture
def ordered(monkeypatch, settings):
    events: list[str] = []
    lock = threading.Lock()

    def note(x: str) -> None:
        with lock:
            events.append(x)

    def create_stream(_s, session, _start):
        note(f"create g{session.generation}")
        time.sleep(0.05)
        session.stream = f"smplwise_pb_{session.id}_g{session.generation}"

    monkeypatch.setattr(pb, "_create_stream", create_stream)
    monkeypatch.setattr(pb, "_delete_stream", lambda _s, name: note(f"delete {name.rsplit('_', 1)[-1]}"))
    cam = {"id": "cam-a", "channel": 1, "main_track": 101}
    session = pb.create(settings, _P(), cam, T0, at(3600), "Asia/Jerusalem", 64)
    events.clear()
    yield SimpleNamespace(session=session, events=events, note=note, settings=settings)
    pb.close(settings, session)
    pb.REGISTRY.sessions.pop(session.id, None)


def _fake_relay(rig, generation: int, close_after: float | None) -> pb.RelayHandle:
    handle = pb.register_relay(rig.session, generation)

    def stop() -> None:
        rig.note(f"stop g{generation}")
        if close_after is not None:
            def later() -> None:
                time.sleep(close_after)
                rig.note(f"relay closed g{generation}")
                pb.release_relay(rig.session, generation, handle)

            threading.Thread(target=later, daemon=True).start()

    handle.bind_stop(stop)
    return handle


def test_seek_closes_the_old_relay_before_deleting_its_stream_and_only_then_creates_the_new_one(ordered):
    _fake_relay(ordered, 0, close_after=0.2)
    pb.seek(ordered.settings, ordered.session, at(60), at(3600))
    assert ordered.events == ["stop g0", "relay closed g0", "delete g0", "create g1"], ordered.events
    assert ordered.session.generation == 1 and ordered.session.state == "buffering" and ordered.session.relays == {}


def test_a_relay_that_does_not_close_delays_the_seek_by_a_bounded_time_only(ordered, monkeypatch):
    monkeypatch.setattr(pb, "RELAY_CLOSE_WAIT_S", 0.3)
    _fake_relay(ordered, 0, close_after=None)
    t = time.monotonic()
    pb.seek(ordered.settings, ordered.session, at(60), at(3600))
    took = time.monotonic() - t
    assert 0.25 <= took < 2, took
    assert ordered.events == ["stop g0", "delete g0", "create g1"]


def test_two_seeks_of_one_session_never_overlap(ordered):
    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(lambda i: pb.seek(ordered.settings, ordered.session, at(60 + i * 30), at(3600)), range(4)))
    creates = [e for e in ordered.events if e.startswith("create")]
    deletes = [e for e in ordered.events if e.startswith("delete")]
    assert creates == ["create g1", "create g2", "create g3", "create g4"], ordered.events
    for g in range(1, 4):  # every old stream goes before the next one is created
        assert ordered.events.index(f"delete g{g - 1}") < ordered.events.index(f"create g{g}")
    assert len(deletes) == 4 and ordered.session.generation == 4


def test_seek_over_the_cap_keeps_the_current_generation(ordered):
    for i in range(3):
        pb.seek(ordered.settings, ordered.session, at(60 + i), at(3600), max_per_min=3)
    stream = ordered.session.stream
    with pytest.raises(ApiError) as exc:
        pb.seek(ordered.settings, ordered.session, at(99), at(3600), max_per_min=3)
    assert exc.value.code == "seek_rate"
    assert ordered.session.generation == 3 and ordered.session.stream == stream and ordered.session.state == "buffering", "nothing torn down"


def test_close_stops_the_relay_before_deleting_the_stream(ordered):
    _fake_relay(ordered, 0, close_after=0.1)
    pb.close(ordered.settings, ordered.session)
    assert ordered.events == ["stop g0", "relay closed g0", "delete g0"]


# -------------------------------------------------------------------------------------------- relay stop_event (real sockets)

def test_relay_stop_event_closes_the_upstream_socket_before_returning():
    import uvicorn
    import websockets
    from fastapi import FastAPI

    from smplwise.services.relay import relay_ws
    from test_playback_stress_2332 import Upstream, _free_port

    up = Upstream()
    session = _bare_session()
    app = FastAPI()
    seen: dict = {}

    @app.websocket("/ws")
    async def ws_endpoint(websocket: WebSocket) -> None:
        await websocket.accept()
        loop = asyncio.get_running_loop()
        evt = asyncio.Event()
        handle = pb.register_relay(session, 0)
        handle.bind_stop(lambda: loop.call_soon_threadsafe(evt.set))
        try:
            seen["reason"] = await relay_ws(websocket, f"ws://127.0.0.1:{up.port}/api/ws", {}, lambda n: None, stop_event=evt, close_timeout=pb.UPSTREAM_CLOSE_TIMEOUT_S)
        finally:
            seen["open_at_return"] = up.open
            pb.release_relay(session, 0, handle)
        await websocket.close(code=4410)

    port = _free_port()
    server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=port, loop="asyncio", http="h11", log_level="warning", lifespan="off"))
    up_loop = asyncio.new_event_loop()
    ready, stop_up = threading.Event(), {}

    def run_upstream() -> None:
        asyncio.set_event_loop(up_loop)

        async def main() -> None:
            stop_up["fut"] = asyncio.get_running_loop().create_future()
            async with websockets.serve(up.handler, "127.0.0.1", up.port, max_size=None):
                ready.set()
                await stop_up["fut"]

        up_loop.run_until_complete(main())

    threading.Thread(target=run_upstream, daemon=True).start()
    assert ready.wait(10)
    threading.Thread(target=server.run, daemon=True).start()
    deadline = time.time() + 15
    while not server.started and time.time() < deadline:
        time.sleep(0.05)

    async def client() -> int | None:
        async with websockets.connect(f"ws://127.0.0.1:{port}/ws", max_size=None) as ws:
            await ws.send('{"type":"mse"}')
            await asyncio.wait_for(ws.recv(), 5)  # media flows
            assert up.open == 1
            handle = session.relays[0]
            t = time.monotonic()
            await asyncio.get_running_loop().run_in_executor(None, handle.stop)
            closed = await asyncio.get_running_loop().run_in_executor(None, handle.closed.wait, 6)
            # alone: ~20 ms; after the crash-guard / recordings suites on the Windows workstation up to ~2.5 s (the close handshake is
            # bounded by UPSTREAM_CLOSE_TIMEOUT_S); without the stop event this relay would never end (no should_stop poll here)
            assert closed and time.monotonic() - t < 6, "stopped and the go2rtc socket closed"
            try:
                while True:
                    await asyncio.wait_for(ws.recv(), 2)
            except websockets.ConnectionClosed as exc:
                return exc.rcvd.code if exc.rcvd else None
        return None

    try:
        code = asyncio.run(client())
        assert code == 4410 and seen["reason"] == "superseded"
        deadline = time.time() + 3
        while up.open and time.time() < deadline:
            time.sleep(0.05)
        assert up.open == 0, "the go2rtc socket is closed"
        assert session.relays == {}
    finally:
        server.should_exit = True
        up_loop.call_soon_threadsafe(lambda: stop_up["fut"].done() or stop_up["fut"].set_result(None))


# ------------------------------------------------------------------------------------------------------------ dependency pins

PINS = {"uvicorn[standard]": "0.53.0", "uvloop": "0.22.1", "httptools": "0.8.0", "websockets": "15.0.1"}


def test_native_networking_packages_are_pinned_exactly():
    lines = [ln.split("#", 1)[0].strip() for ln in (ADDON / "backend" / "requirements.txt").read_text(encoding="utf-8").splitlines()]
    found: dict[str, str] = {}
    for ln in lines:
        m = re.match(r"^([A-Za-z0-9_.\-\[\]]+)\s*==\s*([0-9][^;\s]*)", ln)
        if m:
            found[m.group(1).lower()] = m.group(2)
    for name, ver in PINS.items():
        assert found.get(name) == ver, f"{name} must be pinned to =={ver} (docs/changes/PLAYBACK-SCRUB-2341.md), found {found.get(name)}"
    assert not any(re.match(r"^websockets\s*[<>~!]", ln) for ln in lines), "no websockets range next to the pin"


def test_dockerfile_env_block_is_well_formed():
    text = (ADDON / "Dockerfile").read_text(encoding="utf-8")
    assert "\\n" not in text.replace("\\\n", ""), "a literal \\n in the Dockerfile breaks the ENV instruction (2.33.2 regression)"
    env = re.search(r"^ENV (.+?)(?<!\\)\n", text, re.S | re.M)
    assert env, "ENV block"
    words = env.group(1).replace("\\\n", " ").split()
    assert words and all("=" in w for w in words), words
    assert "PYTHONFAULTHANDLER=1" in words and "PYTHONUNBUFFERED=1" in words
