"""Provision-ISR live finding 2026-10-31 (read-only diagnosis on a live site, NVR8-16400AN fw 1.4.7): go2rtc's RTSP client
sends `Require: www.onvif.org/ver20/backchannel` on DESCRIBE by default; the NVR then answers with an SDP holding ONLY the
PCMU sendonly talk-back track and no video ("codecs not matched:  => video:..."). Every go2rtc source Arx builds for a
Provision recorder (live main / sub, playback) carries go2rtc's `#backchannel=0` unless the connection turns two-way talk on
(`nvr_extra.backchannel`), and the stream sync rewrites existing `smplwise_` streams whose source differs. Fakes only."""
from __future__ import annotations

import dataclasses
import sys
import time
from pathlib import Path
from urllib.parse import parse_qs

import httpx
import pytest
from fastapi.testclient import TestClient

from smplwise.services import autosync
from smplwise.services import go2rtc as g2
from smplwise.services.recorders import provision_isr as pisr
from smplwise.services.recorders import vendor_io

sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from fake_provision import HOST, PASSWORD, USER, FakeProvision, settings_for  # noqa: E402

BASE = f"rtsp://{USER}:{PASSWORD}@{HOST}:554"
G2_HOST = "go2rtc.test"


# ---------------------------------------------------------------------------------------------- the URL builder

def test_ffmpeg_source_gets_backchannel_off_by_default(settings):
    url = f"{BASE}/chID=1&streamType=main"
    assert vendor_io.go2rtc_source(settings_for(settings), url) == f"ffmpeg:{url}#video=copy#backchannel=0"


def test_native_rtsp_source_gets_backchannel_off_by_default(settings):
    url = f"{BASE}/chID=1&streamType=sub1"
    assert vendor_io.go2rtc_source(settings_for(settings, go2rtc_source="rtsp"), url) == f"{url}#backchannel=0"


def test_existing_fragment_is_kept_and_extended(settings):
    url = f"{BASE}/chID=2&streamType=main#timeout=30"
    assert vendor_io.go2rtc_source(settings_for(settings, go2rtc_source="rtsp"), url) == f"{url}#backchannel=0"
    assert vendor_io.go2rtc_source(settings_for(settings), url) == f"ffmpeg:{url}#video=copy#backchannel=0"


def test_an_explicit_backchannel_parameter_is_not_duplicated(settings):
    url = f"{BASE}/chID=2&streamType=main#backchannel=1"
    assert vendor_io.go2rtc_source(settings_for(settings, go2rtc_source="rtsp"), url) == url
    assert vendor_io.with_backchannel_off(f"{BASE}/chID=2&streamType=main#backchannel=0") == f"{BASE}/chID=2&streamType=main#backchannel=0"


def test_trailing_hash_does_not_make_an_empty_parameter():
    assert vendor_io.with_backchannel_off(f"{BASE}/chID=1&streamType=main#") == f"{BASE}/chID=1&streamType=main#backchannel=0"


@pytest.mark.parametrize("on", [True, "true", "True"])
def test_two_way_talk_option_keeps_the_backchannel(settings, on):
    url = f"{BASE}/chID=1&streamType=main"
    assert vendor_io.go2rtc_source(settings_for(settings, go2rtc_source="rtsp", backchannel=on), url) == url
    assert vendor_io.go2rtc_source(settings_for(settings, backchannel=on), url) == f"ffmpeg:{url}#video=copy"


@pytest.mark.parametrize("off", [False, "false", "", None])
def test_two_way_talk_option_off_values(settings, off):
    url = f"{BASE}/chID=1&streamType=main"
    assert vendor_io.go2rtc_source(settings_for(settings, go2rtc_source="rtsp", backchannel=off), url) == f"{url}#backchannel=0"


@pytest.fixture()
def fake(monkeypatch) -> FakeProvision:
    pisr.clear_auth_cache()
    f = FakeProvision()
    f.shape = "live"
    f.names = {1: "Gate", 2: "Lobby", 3: "Yard", 4: "Roof"}
    f.install(monkeypatch)
    return f


def test_live_sources_main_and_sub(settings, fake):
    s = settings_for(settings, auth="basic", go2rtc_source="rtsp")
    src = vendor_io.LiveSources()
    assert src.url(s, "nvr-1", 1, "main") == f"{BASE}/chID=1&streamType=main#backchannel=0"
    assert src.url(s, "nvr-1", 1, "sub") == f"{BASE}/chID=1&streamType=sub1#backchannel=0"
    forced = settings_for(settings, auth="basic", rtsp_style="path")  # the live site's form, through ffmpeg (default)
    assert vendor_io.LiveSources().url(forced, "nvr-1", 3, "sub") == f"ffmpeg:{BASE}/chID=3&streamType=sub#video=copy#backchannel=0"


def test_the_plain_live_url_has_no_fragment(settings, fake):
    """Only the go2rtc source carries go2rtc's parameter: thumbnails / frames hand the adapter's URL to the local ffmpeg."""
    a = pisr.ProvisionIsrAdapter("nvr-1", settings_for(settings, auth="basic"), transport=fake.transport())
    assert "#" not in a.live_source("1", "main")


def test_the_option_is_a_connection_field(settings):
    from smplwise.services.recorders import registry

    undo = pisr.register(selectable=True)
    try:
        f = next(x for x in registry.SPEC_BY_ID[pisr.VENDOR].fields if x.key == "backchannel")
        assert f.kind == "bool" and f.label == "דיבור דו-כיווני דרך המקליט" and f.advanced
    finally:
        undo()


# ---------------------------------------------------------------------------------------------- playback

def test_playback_stream_source_has_backchannel_off(settings, monkeypatch):
    from smplwise.services import playback as pb

    created: list[tuple[str, str]] = []
    monkeypatch.setattr(pb, "playback_rtsp_url", lambda rs, *a, **k: f"{BASE}/chID=8&date=2026-10-04&time=12:50:30&timelen=300&streamType=main&action=playback")
    monkeypatch.setattr(g2.Go2rtc, "ensure_stream", lambda self, name, src, check=None: created.append((name, src)) or "created")
    monkeypatch.setattr("smplwise.recorder_scope.settings_for", lambda s, rid: s)
    import datetime as dt

    s = dataclasses.replace(settings_for(settings), go2rtc_url=f"http://{G2_HOST}:1984")
    now = dt.datetime(2026, 10, 4, 10, 0, tzinfo=dt.timezone.utc)
    session = pb.PlaybackSession(id="abc", camera_id="c1", channel=8, track_id=8, user_id="u", username="u", requested_at=now,
                                 end_at=now + dt.timedelta(minutes=5), stream="", tz_name="Asia/Jerusalem", recorder_id="nvr-1")
    pb._create_stream(s, session, now)
    assert created and created[0][1].endswith("&action=playback#video=copy#backchannel=0") and created[0][1].startswith("ffmpeg:rtsp://")
    created.clear()
    talk = dataclasses.replace(settings_for(settings, backchannel=True), go2rtc_url=f"http://{G2_HOST}:1984")
    pb._create_stream(talk, session, now)
    assert created[0][1].endswith("&action=playback#video=copy")


# ---------------------------------------------------------------------------------------------- the stream sync rewrite

class FakeGo2rtcApi:
    """go2rtc's HTTP API as Arx uses it: GET /api/streams (producers with their source url), PUT ?name=&src=, DELETE ?src=."""

    def __init__(self, store: dict[str, list[str]]) -> None:
        self.store = store
        self.writes: list[tuple[str, str]] = []

    def handle(self, request: httpx.Request) -> httpx.Response:
        if request.url.path != "/api/streams":
            return httpx.Response(404)
        q = {k: v[0] for k, v in parse_qs(request.url.query.decode()).items()}
        if request.method == "GET":
            return httpx.Response(200, json={n: {"producers": [{"url": u} for u in srcs]} for n, srcs in self.store.items()})
        if request.method == "PUT":
            self.writes.append(("put", q["name"]))
            self.store[q["name"]] = [q["src"]]
            return httpx.Response(200)
        if request.method == "DELETE":
            self.writes.append(("delete", q["src"]))
            self.store.pop(q["src"], None)
            return httpx.Response(200)
        return httpx.Response(405)


def _install(monkeypatch, fake: FakeProvision, api: FakeGo2rtcApi) -> None:
    def handle_request(transport, request):
        if request.url.host == HOST:
            return fake.handle(request)
        if request.url.host == G2_HOST:
            return api.handle(request)
        raise AssertionError(f"unexpected host {request.url.host}")

    monkeypatch.setattr(httpx.HTTPTransport, "handle_request", handle_request)


def _wait_cameras(app, n: int, timeout: float = 20.0) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        with app.state.db.connection(mode="read") as conn:
            rows = conn.execute("SELECT capabilities_json, status FROM cameras WHERE recorder_id = 'nvr-1'").fetchall()
        if len(rows) >= n and all("encoding" in (r["capabilities_json"] or "") or r["status"] == "offline" for r in rows):
            return
        time.sleep(0.05)
    raise AssertionError("discovery did not finish")


def test_sync_rewrites_existing_streams_without_the_parameter(settings, monkeypatch):
    """The add-on update case: go2rtc already holds `smplwise_` streams with the old source (no `#backchannel=0`); the next
    sync replaces them, leaves a foreign stream alone, and a second pass changes nothing."""
    from smplwise.main import create_app

    pisr.clear_auth_cache()
    fake = FakeProvision()
    fake.shape = "live"
    fake.names = {1: "Gate", 2: "Lobby", 3: "Yard", 4: "Roof"}
    old_main = f"{BASE}/chID=1&streamType=main"
    foreign = "rtsp://u:p@nvr.other:554/chID=1&streamType=sub"
    api = FakeGo2rtcApi({"smplwise_nvr-1_ch1_main": [old_main], "smplwise_nvr-1_ch1_sub": [f"{BASE}/chID=1&streamType=sub1"], "res1": [foreign]})
    _install(monkeypatch, fake, api)
    s = settings_for(settings, auth="basic", go2rtc_source="rtsp")
    app = create_app(s)  # no go2rtc_url: the start-up pass discovers cameras only
    with TestClient(app):
        _wait_cameras(app, 4)
        synced = dataclasses.replace(s, go2rtc_url=f"http://{G2_HOST}:1984")
        with app.state.db.connection() as conn:
            first = autosync.ensure_streams(synced, conn, reason="startup")
        assert api.store["smplwise_nvr-1_ch1_main"] == [f"{old_main}#backchannel=0"]
        assert api.store["smplwise_nvr-1_ch1_sub"] == [f"{BASE}/chID=1&streamType=sub1#backchannel=0"]
        assert api.store["res1"] == [foreign] and ("delete", "res1") not in api.writes and ("put", "res1") not in api.writes
        assert first["updated"] == 2 and first["created"] >= 2 and first["foreign_streams_untouched"] == 1
        assert all(v[0].endswith("#backchannel=0") for n, v in api.store.items() if n.startswith("smplwise_"))
        api.writes.clear()
        with app.state.db.connection() as conn:
            second = autosync.ensure_streams(synced, conn, reason="periodic")
        assert api.writes == [] and second["updated"] == 0 and second["created"] == 0
        # the owner turns two-way talk on for this connection: the streams go back to the plain source
        talk = dataclasses.replace(settings_for(settings, auth="basic", go2rtc_source="rtsp", backchannel=True), go2rtc_url=f"http://{G2_HOST}:1984")
        with app.state.db.connection() as conn:
            third = autosync.ensure_streams(talk, conn, reason="manual")
        assert api.store["smplwise_nvr-1_ch1_main"] == [old_main] and third["updated"] >= 2
