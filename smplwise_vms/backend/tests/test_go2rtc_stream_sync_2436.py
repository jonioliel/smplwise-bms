"""GO2RTC-STREAM-SYNC-2436 (docs/changes/GO2RTC-STREAM-SYNC-2436.md; lab 12.11, docs/lab/LAB-VIDEO-MEASURE-2026-11-12.md).

1. go2rtc 1.9.15 reports a stream's source without its user and password, so `ensure_stream` never saw "unchanged" and deleted +
   re-created every stream on each live open and each 10-minute sync. Sources are compared by their parts now; a hidden part counts
   only when this process wrote exactly that source.
2. `online` / `state` of `GET /media/streams` from the real 1.9 shapes: an idle on-demand stream is `idle` (ready), not down.
3. A replaced playback generation says `{"type":"replaced"}` before its 4410 (HA ingress delivers the close as 1000).

Fixtures (tests/fixtures/go2rtc/) are synthetic values in the recorded 1.9.14 / 1.9.15 shapes - no lab address or credential.
"""
from __future__ import annotations

import json
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

import httpx
import pytest

from smplwise.services import go2rtc as g2

FIX = Path(__file__).parent / "fixtures" / "go2rtc"
SRC_MAIN = "rtsp://viewer:p%40ss%3Aword@nvr.example.invalid:554/Streaming/Channels/101"
SRC_SUB = "rtsp://viewer:p%40ss%3Aword@nvr.example.invalid:554/Streaming/Channels/102"


def load(name: str) -> dict:
    data = json.loads((FIX / name).read_text(encoding="utf-8"))
    data.pop("_note", None)
    return data


def strip_userinfo(url: str) -> str:
    p = urlsplit(url)
    host = p.hostname or ""
    return urlunsplit((p.scheme, f"{host}:{p.port}" if p.port else host, p.path, p.query, p.fragment))


class FakeGo2rtcServer:
    """A go2rtc `/api/streams` in memory. `redacts` True answers like 1.9.15 (sources without user / password), False like 1.9.14."""

    def __init__(self, streams: dict, redacts: bool):
        self.store = {n: [p.get("url", "") for p in (v or {}).get("producers") or []] for n, v in streams.items()}
        self.redacts = redacts
        self.writes: list[tuple[str, str]] = []

    def handler(self, request: httpx.Request) -> httpx.Response:
        name = request.url.params.get("name") or request.url.params.get("src")
        if request.method == "GET":
            shown = {n: {"producers": [{"url": strip_userinfo(u) if self.redacts else u} for u in srcs], "consumers": None} for n, srcs in self.store.items()}
            return httpx.Response(200, json=shown)
        if request.method == "DELETE":
            self.writes.append(("DELETE", name))
            self.store.pop(name, None)
            return httpx.Response(200)
        if request.method == "PUT":
            self.writes.append(("PUT", name))
            self.store[name] = [request.url.params["src"]]
            return httpx.Response(200)
        return httpx.Response(405)


@pytest.fixture(autouse=True)
def _clean_written():
    with g2._SOURCE_DIGEST_LOCK:
        g2._SOURCE_DIGEST.clear()
    yield
    with g2._SOURCE_DIGEST_LOCK:
        g2._SOURCE_DIGEST.clear()


def client_for(server: FakeGo2rtcServer) -> g2.Go2rtc:
    c = g2.Go2rtc.__new__(g2.Go2rtc)
    c.base = "http://go2rtc.example.invalid:1984"
    c.auth = None
    c._client = lambda: httpx.Client(base_url=c.base, transport=httpx.MockTransport(server.handler))  # type: ignore[method-assign]
    return c


# ------------------------------------------------------------------------------------------------------------- 1. stream sync


@pytest.mark.parametrize("fixture,redacts", [("streams_1_9_14_idle.json", False), ("streams_1_9_15_idle.json", True)])
def test_an_unchanged_stream_is_written_at_most_once_per_process(fixture, redacts):
    """1.9.14 (whole source shown): never written. 1.9.15 (credentials hidden): written once after a restart, then never again."""
    shapes = load(fixture)
    server = FakeGo2rtcServer(load("streams_1_9_14_idle.json"), redacts=redacts)
    # the fake answers in the recorded shape of that version
    assert server.handler(httpx.Request("GET", "http://go2rtc.example.invalid/api/streams")).json() == shapes
    g = client_for(server)
    first = [g.ensure_stream("smplwise_nvr-1_ch1_main", SRC_MAIN), g.ensure_stream("smplwise_nvr-1_ch1_sub", SRC_SUB)]
    assert first == (["unchanged", "unchanged"] if not redacts else ["updated", "updated"])
    writes_after_first = len(server.writes)
    # every later live open and every 10-minute sync: nothing written (lab 12.11: ~200 writes an hour before the fix)
    for _ in range(20):
        assert g.ensure_stream("smplwise_nvr-1_ch1_main", SRC_MAIN) == "unchanged"
        assert g.ensure_stream("smplwise_nvr-1_ch1_sub", SRC_SUB) == "unchanged"
    assert len(server.writes) == writes_after_first
    assert all(name.startswith("smplwise_") for _, name in server.writes), "a foreign stream is never written"
    assert server.store["door_station_1"] == [load("streams_1_9_14_idle.json")["door_station_1"]["producers"][0]["url"]]


def test_an_upgrade_from_1_9_14_to_1_9_15_writes_nothing():
    server = FakeGo2rtcServer(load("streams_1_9_14_idle.json"), redacts=False)
    g = client_for(server)
    assert g.ensure_stream("smplwise_nvr-1_ch1_main", SRC_MAIN) == "unchanged"
    server.redacts = True  # go2rtc upgraded in place (the add-on keeps running)
    assert g.ensure_stream("smplwise_nvr-1_ch1_main", SRC_MAIN) == "unchanged"
    assert server.writes == []


@pytest.mark.parametrize("redacts", [False, True])
def test_a_changed_password_is_still_applied(redacts):
    server = FakeGo2rtcServer(load("streams_1_9_14_idle.json"), redacts=redacts)
    g = client_for(server)
    g.ensure_stream("smplwise_nvr-1_ch1_main", SRC_MAIN)
    new = SRC_MAIN.replace("p%40ss%3Aword", "n3w")
    assert g.ensure_stream("smplwise_nvr-1_ch1_main", new) == "updated"
    assert server.store["smplwise_nvr-1_ch1_main"] == [new]
    assert g.ensure_stream("smplwise_nvr-1_ch1_main", new) == "unchanged"


@pytest.mark.parametrize("redacts", [False, True])
def test_a_changed_address_path_or_port_is_rewritten(redacts):
    server = FakeGo2rtcServer(load("streams_1_9_14_idle.json"), redacts=redacts)
    g = client_for(server)
    g.ensure_stream("smplwise_nvr-1_ch1_main", SRC_MAIN)
    for other in (SRC_MAIN.replace("nvr.example", "nvr2.example"), SRC_MAIN.replace(":554/", ":8554/"), SRC_MAIN.replace("/101", "/103")):
        assert g.ensure_stream("smplwise_nvr-1_ch1_main", other) == "updated", other


def test_a_stream_deleted_by_us_is_written_again():
    server = FakeGo2rtcServer(load("streams_1_9_14_idle.json"), redacts=True)
    g = client_for(server)
    g.ensure_stream("smplwise_nvr-1_ch1_main", SRC_MAIN)
    g.delete_stream("smplwise_nvr-1_ch1_main")
    assert g.ensure_stream("smplwise_nvr-1_ch1_main", SRC_MAIN) == "created"


def test_the_namespace_guard_is_unchanged():
    g = client_for(FakeGo2rtcServer({}, redacts=True))
    with pytest.raises(ValueError):
        g.ensure_stream("door_station_1", SRC_MAIN)


@pytest.mark.parametrize(
    "reported,wanted,verdict",
    [
        (SRC_MAIN, SRC_MAIN, g2.SAME),
        ("rtsp://nvr.example.invalid:554/Streaming/Channels/101", SRC_MAIN, g2.SAME_IF_HIDDEN),  # 1.9.15
        ("rtsp://***@nvr.example.invalid:554/Streaming/Channels/101", SRC_MAIN, g2.SAME_IF_HIDDEN),  # a masked userinfo
        ("rtsp://viewer:xxxxx@nvr.example.invalid:554/Streaming/Channels/101", SRC_MAIN, g2.SAME_IF_HIDDEN),  # the password masked
        ("rtsp://viewer:p@ss:word@nvr.example.invalid:554/Streaming/Channels/101".replace("p@ss:word", "p%40ss%3Aword"), SRC_MAIN, g2.SAME),
        ("rtsp://other:p%40ss%3Aword@nvr.example.invalid:554/Streaming/Channels/101", SRC_MAIN, g2.DIFFERENT),  # another user shown
        ("rtsp://viewer:old@nvr.example.invalid:554/Streaming/Channels/101", SRC_MAIN, g2.DIFFERENT),  # another password shown
        ("RTSP://NVR.example.invalid/Streaming/Channels/101", SRC_MAIN, g2.SAME_IF_HIDDEN),  # case, the default port
        ("rtsp://nvr.example.invalid:554/Streaming/Channels/101", "rtsp://nvr.example.invalid:554/Streaming/Channels/101", g2.SAME),
        ("rtsp://u:p@nvr.example.invalid:554/Streaming/Channels/101", "rtsp://nvr.example.invalid:554/Streaming/Channels/101", g2.DIFFERENT),
        # playback sources: the query in another order is the same; a hidden token value is only "same if hidden"
        ("rtsp://nvr.example.invalid:554/Streaming/tracks/101?endtime=20260914T120000Z&starttime=20260914T100000Z",
         "rtsp://u:p@nvr.example.invalid:554/Streaming/tracks/101?starttime=20260914T100000Z&endtime=20260914T120000Z", g2.SAME_IF_HIDDEN),
        ("rtsp://nvr.example.invalid:554/Streaming/tracks/101?starttime=20260914T110000Z&endtime=20260914T120000Z",
         "rtsp://u:p@nvr.example.invalid:554/Streaming/tracks/101?starttime=20260914T100000Z&endtime=20260914T120000Z", g2.DIFFERENT),
        ("http://cam.example.invalid/api/stream?token=***", "http://cam.example.invalid/api/stream?token=abc", g2.SAME_IF_HIDDEN),
        ("http://cam.example.invalid/api/stream?token=zzz", "http://cam.example.invalid/api/stream?token=abc", g2.DIFFERENT),
        ("http://cam.example.invalid/api/stream", "http://cam.example.invalid/api/stream?token=abc", g2.DIFFERENT),
        # go2rtc `#` options in another order
        ("rtsp://nvr.example.invalid/Streaming/Channels/101#audio=aac#video=copy", "rtsp://u:p@nvr.example.invalid/Streaming/Channels/101#video=copy#audio=aac", g2.SAME_IF_HIDDEN),
        ("ffmpeg:rtsp://nvr.example.invalid/x#video=h264", "ffmpeg:rtsp://u:p@nvr.example.invalid/x#video=h264", g2.SAME_IF_HIDDEN),
        ("ffmpeg:rtsp://nvr.example.invalid/x#video=h264", "ffmpeg:rtsp://u:p@nvr.example.invalid/y#video=h264", g2.DIFFERENT),
        ("rtsp://nvr.example.invalid:notaport/x", SRC_MAIN, g2.DIFFERENT),
        ("", SRC_MAIN, g2.DIFFERENT),
    ],
)
def test_compare_source(reported, wanted, verdict):
    assert g2.compare_source(reported, wanted) == verdict


def test_the_process_memory_holds_a_digest_never_the_source():
    server = FakeGo2rtcServer({}, redacts=True)
    client_for(server).ensure_stream("smplwise_nvr-1_ch1_main", SRC_MAIN)
    held = json.dumps(g2._SOURCE_DIGEST)
    assert "p%40ss" not in held and "nvr.example" not in held and len(g2._SOURCE_DIGEST["smplwise_nvr-1_ch1_main"]) == 64


# --------------------------------------------------------------------------------------------------------- 2. online / state


def list_from(fixture: str) -> dict[str, g2.StreamInfo]:
    data = load(fixture)
    g = g2.Go2rtc.__new__(g2.Go2rtc)
    g.base = "http://go2rtc.example.invalid:1984"
    g.auth = None
    g._client = lambda: httpx.Client(base_url=g.base, transport=httpx.MockTransport(lambda r: httpx.Response(200, json=data)))  # type: ignore[method-assign]
    return g.list_streams()


@pytest.mark.parametrize("fixture", ["streams_1_9_14_idle.json", "streams_1_9_15_idle.json"])
def test_idle_on_demand_streams_are_ready_not_down(fixture):
    s = list_from(fixture)
    for name in ("smplwise_nvr-1_ch1_main", "smplwise_nvr-1_ch1_sub"):
        assert s[name].online is False and s[name].state == "idle" and s[name].consumers == 0 and s[name].video_codec is None


def test_a_watched_stream_is_active_with_its_viewers_and_codec():
    s = list_from("streams_1_9_15_active.json")
    main = s["smplwise_nvr-1_ch1_main"]
    assert main.online is True and main.state == "active" and main.consumers == 1 and main.video_codec == "h264"
    assert s["smplwise_nvr-1_ch1_sub"].state == "idle"
    assert s["smplwise_ha_garage"].state == "no_source" and s["smplwise_ha_garage"].online is False


def test_a_consumer_alone_counts_as_active():
    """go2rtc is dialling the source for a viewer that just arrived: the producer is still `{url}` but the stream is in use."""
    data = {"smplwise_nvr-1_ch1_main": {"producers": [{"url": "rtsp://nvr.example.invalid/Streaming/Channels/101"}], "consumers": [{"id": 1}]}}
    g = g2.Go2rtc.__new__(g2.Go2rtc)
    g.base, g.auth = "http://go2rtc.example.invalid:1984", None
    g._client = lambda: httpx.Client(base_url=g.base, transport=httpx.MockTransport(lambda r: httpx.Response(200, json=data)))  # type: ignore[method-assign]
    info = g.list_streams()["smplwise_nvr-1_ch1_main"]
    assert info.online is True and info.state == "active" and info.consumers == 1


def test_media_streams_reports_state_and_viewers(monkeypatch):
    """The route: `state` / `consumers` next to `online`, sources still redacted, foreign streams only counted."""
    from smplwise.routers import media

    streams = list_from("streams_1_9_15_active.json")

    class Fake:
        def __init__(self, _settings):
            pass

        def list_streams(self):
            return streams

        def info(self):
            return {"version": "1.9.15"}

    monkeypatch.setattr(media.g2, "Go2rtc", Fake)
    monkeypatch.setattr(media, "require", lambda *a, **k: None)
    monkeypatch.setattr(media, "ensure_capability", lambda *a, **k: None)
    monkeypatch.setattr(media, "settings_of", lambda _r: object())

    class Conn:
        pass

    import contextlib

    monkeypatch.setattr(media, "unlocked", lambda _c: contextlib.nullcontext())
    out = media.list_streams(request=None, principal=None, conn=Conn())  # type: ignore[arg-type]
    by = {s["name"]: s for s in out["streams"]}
    assert by["smplwise_nvr-1_ch1_main"] | {"sources": None} == {"name": "smplwise_nvr-1_ch1_main", "online": True, "state": "active", "consumers": 1, "sources": None}
    assert by["smplwise_nvr-1_ch1_sub"]["state"] == "idle" and by["smplwise_nvr-1_ch1_sub"]["online"] is False
    assert out["foreign_streams"] == 0


def test_health_report_says_ready_not_offline(monkeypatch):
    from smplwise.services import health_report

    streams = list_from("streams_1_9_15_idle.json")

    class Fake:
        def __init__(self, _settings):
            pass

        def info(self):
            return {"version": "1.9.15"}

        def list_streams(self):
            return streams

    monkeypatch.setattr(g2, "Go2rtc", Fake)

    class S:
        go2rtc_url = "http://go2rtc.example.invalid:1984"

    r = health_report._probe_go2rtc(S())  # type: ignore[arg-type]
    assert r["status"] == "ok" and r["online"] == 0 and r["idle"] == 2 and r["foreign"] == 1
    assert "2 מוכנים" in r["detail"]


# ----------------------------------------------------------------------------------------------------------- 3. replaced socket


def test_a_replaced_socket_says_so_before_its_4410():
    """Both paths of routers/playback (an old generation connecting, a generation replaced while it streams) use close_replaced."""
    from starlette.applications import Starlette
    from starlette.routing import WebSocketRoute
    from starlette.testclient import TestClient
    from starlette.websockets import WebSocketDisconnect

    from smplwise.routers.playback import close_replaced

    async def before_accept(ws):
        await close_replaced(ws)

    async def while_streaming(ws):
        await ws.accept()
        await ws.send_bytes(b"fragment")
        await close_replaced(ws)

    app = Starlette(routes=[WebSocketRoute("/a", before_accept), WebSocketRoute("/b", while_streaming)])
    with TestClient(app) as tc:
        for path, first in (("/a", None), ("/b", b"fragment")):
            with tc.websocket_connect(path) as ws:
                if first is not None:
                    assert ws.receive_bytes() == first
                assert json.loads(ws.receive_text()) == {"type": "replaced", "value": "superseded"}
                with pytest.raises(WebSocketDisconnect) as closed:
                    ws.receive_text()
                assert closed.value.code == 4410


# ---------------------------------------------------------------------------- 4. one adapter (CR-GO2RTC-ADAPTER-2436, review 03)
# F03: a stream sync lists go2rtc ONCE and a playback create (a name new by construction) never lists. F20: the four RTSP addresses
# with credentials come from one builder (golden strings pinned before the change). F12: a bad listing body is `media_error`, and
# `frame_jpeg` / `ws_url` refuse a name outside the namespace themselves. F10: the probe grab in the adapter. F04: the shared TLS
# context on the per-request clients.


class CountingServer(FakeGo2rtcServer):
    def __init__(self, streams: dict, redacts: bool):
        super().__init__(streams, redacts)
        self.gets = 0

    def handler(self, request: httpx.Request) -> httpx.Response:
        if request.method == "GET" and request.url.path == "/api/streams":
            self.gets += 1
        return super().handler(request)


def adapter_on(server: FakeGo2rtcServer, monkeypatch) -> type:
    """The REAL adapter class, its HTTP client on the in-memory server (every module that imports `go2rtc as g2` sees it)."""

    class Adapter(g2.Go2rtc):
        def _client(self) -> httpx.Client:
            return httpx.Client(base_url=self.base, transport=httpx.MockTransport(server.handler))

    monkeypatch.setattr(g2, "Go2rtc", Adapter)
    return Adapter


def _nvr_settings(settings):
    from dataclasses import replace

    return replace(settings, nvr_host="nvr.example.invalid", nvr_user="u", nvr_password="p", go2rtc_url="http://go2rtc.example.invalid:1984")


@pytest.mark.parametrize("redacts", [False, True])
def test_one_stream_sync_lists_go2rtc_once(settings, monkeypatch, redacts):
    from fastapi.testclient import TestClient

    from smplwise.main import create_app
    from smplwise.services import autosync

    s = _nvr_settings(settings)
    app = create_app(s)
    c = TestClient(app)
    for ch in (1, 2, 3):
        assert c.post("/api/v1/cameras", json={"channel": ch, "alias": f"c{ch}"}).status_code in (200, 201)
    server = CountingServer(load("streams_1_9_14_idle.json"), redacts=redacts)
    foreign_before = {n: list(v) for n, v in server.store.items() if not n.startswith("smplwise_")}
    adapter_on(server, monkeypatch)
    with app.state.db.connection() as conn:
        first = autosync.ensure_streams(s, conn, reason="manual")
    assert server.gets == 1, "one listing for the whole sync (was 2N+1)"
    assert first["created"] + first["updated"] + first["unchanged"] == 6 and first["foreign_streams_untouched"] == len(foreign_before)
    server.gets = 0
    writes = len(server.writes)
    with app.state.db.connection() as conn:
        again = autosync.ensure_streams(s, conn, reason="manual")
    assert server.gets == 1 and again["unchanged"] == 6 and len(server.writes) == writes, "a second sync writes nothing"
    assert all(name.startswith("smplwise_") for _, name in server.writes), "only smplwise_ streams are ever written or deleted"
    assert {n: v for n, v in server.store.items() if not n.startswith("smplwise_")} == foreign_before


def test_the_shared_listing_follows_the_writes_of_the_sync():
    """`ensure_stream(streams=)` decides from the caller's listing exactly as from its own, and keeps that copy current."""
    server = CountingServer({}, redacts=True)
    g = client_for(server)
    listing = g.list_streams()
    assert server.gets == 1
    assert g.ensure_stream("smplwise_nvr-1_ch1_main", SRC_MAIN, streams=listing) == "created"
    assert listing["smplwise_nvr-1_ch1_main"].sources == [SRC_MAIN] and server.gets == 1
    assert g.ensure_stream("smplwise_nvr-1_ch1_main", SRC_MAIN, streams=listing) == "unchanged"
    new = SRC_MAIN.replace("p%40ss%3Aword", "n3w")
    assert g.ensure_stream("smplwise_nvr-1_ch1_main", new, streams=listing) == "updated" and server.store["smplwise_nvr-1_ch1_main"] == [new]
    seen: list[dict] = []
    g.ensure_stream("smplwise_nvr-1_ch1_sub", SRC_SUB, check=seen.append, streams=listing)
    assert seen == [listing], "`check` receives the same listing"
    assert server.gets == 1, "no listing was fetched again"
    with pytest.raises(ValueError):
        g.ensure_stream("door_station_1", SRC_MAIN, streams=listing)


def test_a_playback_create_never_lists_go2rtc(settings, monkeypatch):
    import datetime as dt

    from smplwise.services import playback as pb

    s = _nvr_settings(settings)
    server = CountingServer(load("streams_1_9_14_idle.json"), redacts=True)
    adapter_on(server, monkeypatch)
    pb.set_instance_id("t2436")
    start = dt.datetime(2026, 9, 14, 10, 0, tzinfo=dt.timezone.utc)
    session = pb.PlaybackSession(id="abcdef0123", camera_id="cam", channel=1, track_id=101, user_id="u", username="u",
                                 requested_at=start, end_at=start + dt.timedelta(hours=1), stream="", tz_name="UTC")
    pb._create_stream(s, session, start)
    session.generation = 1
    pb._create_stream(s, session, start + dt.timedelta(minutes=5))
    assert server.gets == 0, "a playback generation is new by construction: written without a listing"
    assert server.writes == [("PUT", "smplwise_pb_t2436_abcdef0123_g0"), ("PUT", "smplwise_pb_t2436_abcdef0123_g1")]
    assert session.stream == "smplwise_pb_t2436_abcdef0123_g1"


def test_create_stream_guards_and_refusal():
    server = CountingServer({}, redacts=True)
    g = client_for(server)
    for bad in ("door_station_1", "smplwise_bad name", "smplwise_a/../b"):
        with pytest.raises(ValueError):
            g.create_stream(bad, SRC_MAIN)
    assert server.writes == []
    refusing = FakeGo2rtcServer({}, redacts=True)
    refusing.handler = lambda request: httpx.Response(400)  # type: ignore[method-assign]
    with pytest.raises(g2.ApiError) as e:
        client_for(refusing).create_stream("smplwise_pb_x_g0", SRC_MAIN)
    assert e.value.code == "media_error" and "smplwise_pb_x_g0" not in g2._SOURCE_DIGEST


# --- F20: the four RTSP addresses with credentials (pinned before the shared builder; a user and a password with @ : / #)
USER = "op@x:y/z#"
PASSWORD = "p@ss:w/rd#1"
Q_USER, Q_PASSWORD = "op%40x%3Ay%2Fz%23", "p%40ss%3Aw%2Frd%231"


def test_golden_rtsp_addresses(settings):
    import dataclasses
    import datetime as dt

    from smplwise.services import playback as pb
    from smplwise.services.recorders import frigate_restream as frs

    s = dataclasses.replace(settings, nvr_host="nvr.example.invalid", nvr_user=USER, nvr_password=PASSWORD, go2rtc_url="http://go2rtc.example.invalid:1984")
    assert g2.hikvision_rtsp_url(s, 4, "main") == f"rtsp://{Q_USER}:{Q_PASSWORD}@nvr.example.invalid:554/Streaming/Channels/401"
    assert g2.hikvision_rtsp_url(s, 12, "sub") == f"rtsp://{Q_USER}:{Q_PASSWORD}@nvr.example.invalid:554/Streaming/Channels/1202"
    assert g2.wiskey_rtsp_url("door.example.invalid", USER, PASSWORD) == f"rtsp://{Q_USER}:{Q_PASSWORD}@door.example.invalid:554/Streaming/Channels/101"
    assert g2.wiskey_rtsp_url("fd00::21", USER, PASSWORD) == f"rtsp://{Q_USER}:{Q_PASSWORD}@[fd00::21]:554/Streaming/Channels/101"
    start = dt.datetime(2026, 9, 14, 10, 0, tzinfo=dt.timezone.utc)
    assert pb._hikvision_playback_rtsp_url(s, 101, start, start + dt.timedelta(hours=2), "UTC") == (
        f"rtsp://{Q_USER}:{Q_PASSWORD}@nvr.example.invalid:554/Streaming/tracks/101?starttime=20260914T100000Z&endtime=20260914T120000Z")
    fr = dataclasses.replace(s, nvr_extra={"restream_auth": "account", "restream_port": 18554})
    assert frs.source_url(fr, "cam_front") == f"rtsp://{Q_USER}:{Q_PASSWORD}@nvr.example.invalid:18554/cam_front"


def test_rtsp_url_builder():
    assert g2.rtsp_url("h.example.invalid", 554, "/Streaming/Channels/101", USER, PASSWORD) == f"rtsp://{Q_USER}:{Q_PASSWORD}@h.example.invalid:554/Streaming/Channels/101"
    assert g2.rtsp_url("h.example.invalid", 8554, "/x", USER, PASSWORD, query="a=1&b=2") == f"rtsp://{Q_USER}:{Q_PASSWORD}@h.example.invalid:8554/x?a=1&b=2"


# --- F12: a bad listing body, and the namespace guard inside frame_jpeg / ws_url


@pytest.mark.parametrize("body", [b"<html>proxy login</html>", b"[1, 2]", b"\"text\""])
def test_a_bad_listing_body_is_media_error_not_a_crash(body):
    g = g2.Go2rtc.__new__(g2.Go2rtc)
    g.base, g.auth = "http://go2rtc.example.invalid:1984", None
    g._client = lambda: httpx.Client(base_url=g.base, transport=httpx.MockTransport(lambda r: httpx.Response(200, content=body)))  # type: ignore[method-assign]
    with pytest.raises(g2.ApiError) as e:
        g.list_streams()
    assert e.value.status == 503 and e.value.code == "media_error"


def test_frame_jpeg_refuses_a_name_that_is_not_plain():
    g = client_for(FakeGo2rtcServer({}, redacts=True))
    for bad in ("door_station_1", "smplwise_a/../b", "smplwise_x&src=rtsp://evil"):
        with pytest.raises(ValueError):
            g.frame_jpeg(bad, SRC_MAIN)


def test_ws_url_refuses_a_name_outside_the_namespace():
    g = client_for(FakeGo2rtcServer({}, redacts=True))
    assert g.ws_url("smplwise_nvr-1_ch4_sub") == "ws://go2rtc.example.invalid:1984/api/ws?src=smplwise_nvr-1_ch4_sub"
    for bad in ("door_station_1", "smplwise_x&src=door_station_1", ""):
        with pytest.raises(ValueError):
            g.ws_url(bad)


# --- F10 (adapter half): the probe grab through the adapter, with the reachability hooks


def test_grab_probe_returns_the_frame_or_the_head_of_the_error(monkeypatch):
    from smplwise.services import media_reach

    seen: list[dict] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append({"path": request.url.path, **dict(request.url.params)})
        if request.url.params.get("name") == "smplwise_cam_probe_ok":
            return httpx.Response(200, content=b"\xff\xd8\xff" + b"j" * 10)
        return httpx.Response(500, content=b"E" * 1000)

    built: list[float] = []

    class Adapter(g2.Go2rtc):
        def _client_for(self, timeout_s: float) -> httpx.Client:
            built.append(timeout_s)
            return httpx.Client(base_url=self.base, transport=httpx.MockTransport(handler), event_hooks=g2._REACH_HOOKS)

    g = Adapter.__new__(Adapter)
    g.base, g.auth = "http://go2rtc.example.invalid:1984", None
    oks: list[int] = []
    monkeypatch.setattr(media_reach.REACH, "record_ok", lambda: oks.append(1))
    status, body, err = g.grab_probe("smplwise_cam_probe_ok", "rtsp://cam.example.invalid/x", timeout_s=7.0)
    assert (status, body[:3], err) == (200, b"\xff\xd8\xff", "")
    status, body, err = g.grab_probe("smplwise_cam_probe_bad", "rtsp://cam.example.invalid/x")
    assert status == 500 and err == "E" * 300
    assert built == [7.0, 15.0] and len(oks) == 2, "the reachability hook sees the probe"
    assert seen[0] == {"path": "/api/frame.jpeg", "src": "rtsp://cam.example.invalid/x", "name": "smplwise_cam_probe_ok"}
    with pytest.raises(ValueError):
        g.grab_probe("door_station_1", "rtsp://cam.example.invalid/x")


def test_grab_probe_timeout_is_reported_not_raised():
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("slow", request=request)

    class Adapter(g2.Go2rtc):
        def _client_for(self, timeout_s: float) -> httpx.Client:
            return httpx.Client(base_url=self.base, transport=httpx.MockTransport(handler))

    g = Adapter.__new__(Adapter)
    g.base, g.auth = "http://go2rtc.example.invalid:1984", None
    assert g.grab_probe("smplwise_cam_probe_x", "rtsp://cam.example.invalid/x") == (0, b"", "timeout")


# --- F04: the shared TLS context on a per-request client outside the adapter (the cast clients: tests/test_cast_relay.py)


def test_the_bridge_media_question_uses_the_shared_tls_context(settings, monkeypatch):
    from smplwise.services import media_query, nvr

    seen: list[object] = []
    real_client = httpx.Client

    class Client(real_client):  # type: ignore[misc, valid-type]
        def __init__(self, *a, **k):
            seen.append(k.get("verify"))
            super().__init__(*a, **{**k, "transport": httpx.MockTransport(lambda r: httpx.Response(200, json={"service_response": {"ok": True}}))})

    monkeypatch.setattr(media_query.httpx, "Client", Client)
    monkeypatch.setattr(media_query.ha_client, "configured", lambda _s: True)
    monkeypatch.setattr(media_query.ha_client, "_rest_base", lambda _s: "http://ha.example.invalid:8123/api")
    monkeypatch.setattr(media_query.ha_client, "_headers", lambda _s: {})
    monkeypatch.setattr(media_query.ha_client, "_guard_subject", lambda _p: None)
    assert media_query.call_bridge_media_query(settings, {"query": "queue"}) == {"ok": True}
    assert seen == [nvr._ssl_context()]
