"""AZIA-LIVE-2331: the live source path of a Provision camera is read from the NVR (GetStreamCaps) at most once per channel
and LIVE_CAPS_TTL_S across adapters, and a viewer opening a camera while that read fails for a moment gets the stream go2rtc
already holds instead of a refused socket. Before, every live socket and every sync pass built a fresh adapter, so a 16-tile
wall was 16 GetStreamCaps calls at once to the NVR's small HTTP server, and each failed read refused its tile. Fakes only."""
from __future__ import annotations

import dataclasses
import sys
from pathlib import Path
from urllib.parse import parse_qs

import httpx
import pytest

from smplwise.errors import ApiError
from smplwise.routers import media
from smplwise.services import go2rtc as g2
from smplwise.services.recorders import provision_isr as pisr
from smplwise.services.recorders import vendor_io

sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from fake_provision import HOST, PASSWORD, USER, FakeProvision, settings_for  # noqa: E402

BASE = f"rtsp://{USER}:{PASSWORD}@{HOST}:554"
G2_HOST = "go2rtc.test"
STREAM = "smplwise_nvr-1_ch1_sub"


@pytest.fixture()
def fake(monkeypatch) -> FakeProvision:
    pisr.clear_auth_cache()
    f = FakeProvision()
    f.shape = "live"
    f.names = {1: "Gate", 2: "Lobby", 3: "Yard", 4: "Roof"}
    f.install(monkeypatch)
    yield f
    pisr.clear_auth_cache()


def _caps_reads(fake: FakeProvision, ch: int) -> int:
    return sum(1 for h in fake.hits if h == f"POST /GetStreamCaps/{ch}")


# ---------------------------------------------------------------------------------------------- the shared caps cache

def test_caps_are_read_once_across_adapters(settings, fake):
    s = settings_for(settings, auth="basic", go2rtc_source="rtsp")
    first = vendor_io.LiveSources().url(s, "nvr-1", 1, "sub")
    for _ in range(5):  # five more viewers, each through its own adapter (the live socket path)
        assert vendor_io.LiveSources().url(s, "nvr-1", 1, "sub") == first
        assert vendor_io.LiveSources().url(s, "nvr-1", 1, "main").endswith("streamType=main#backchannel=0")
    assert first == f"{BASE}/chID=1&streamType=sub1#backchannel=0"
    assert _caps_reads(fake, 1) == 1


def test_each_channel_has_its_own_entry(settings, fake):
    s = settings_for(settings, auth="basic", go2rtc_source="rtsp")
    for ch in (1, 2, 1, 2):
        vendor_io.LiveSources().url(s, "nvr-1", ch, "sub")
    assert _caps_reads(fake, 1) == 1 and _caps_reads(fake, 2) == 1


def test_a_failed_read_is_not_cached(settings, fake):
    s = settings_for(settings, auth="basic", go2rtc_source="rtsp")
    fake.down = True
    with pytest.raises(ApiError) as exc:
        vendor_io.LiveSources().url(s, "nvr-1", 1, "sub")
    assert exc.value.code == "source_unavailable"
    fake.down = False
    assert vendor_io.LiveSources().url(s, "nvr-1", 1, "sub") == f"{BASE}/chID=1&streamType=sub1#backchannel=0"
    assert _caps_reads(fake, 1) == 1


def test_the_entry_expires(settings, fake, monkeypatch):
    s = settings_for(settings, auth="basic", go2rtc_source="rtsp")
    clock = [1000.0]
    monkeypatch.setattr(pisr, "_monotonic", lambda: clock[0])
    vendor_io.LiveSources().url(s, "nvr-1", 1, "sub")
    clock[0] += pisr.LIVE_CAPS_TTL_S - 1
    vendor_io.LiveSources().url(s, "nvr-1", 1, "sub")
    assert _caps_reads(fake, 1) == 1
    clock[0] += 2
    vendor_io.LiveSources().url(s, "nvr-1", 1, "sub")
    assert _caps_reads(fake, 1) == 2


def test_clear_auth_cache_drops_the_entries(settings, fake):
    s = settings_for(settings, auth="basic", go2rtc_source="rtsp")
    vendor_io.LiveSources().url(s, "nvr-1", 1, "sub")
    pisr.clear_auth_cache()
    vendor_io.LiveSources().url(s, "nvr-1", 1, "sub")
    assert _caps_reads(fake, 1) == 2


def test_a_forced_path_style_still_makes_no_device_call(settings, fake):
    s = settings_for(settings, auth="basic", go2rtc_source="rtsp", rtsp_style="path")
    assert vendor_io.LiveSources().url(s, "nvr-1", 3, "sub") == f"{BASE}/chID=3&streamType=sub#backchannel=0"
    assert _caps_reads(fake, 3) == 0


# ---------------------------------------------------------------------------------------------- the live socket fallback

class FakeGo2rtcApi:
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


@pytest.fixture()
def g2api(monkeypatch, fake) -> FakeGo2rtcApi:
    api = FakeGo2rtcApi({})

    def handle_request(transport, request):
        if request.url.host == HOST:
            return fake.handle(request)
        if request.url.host == G2_HOST:
            return api.handle(request)
        raise AssertionError(f"unexpected host {request.url.host}")

    monkeypatch.setattr(httpx.HTTPTransport, "handle_request", handle_request)
    return api


CAM = {"recorder_id": "nvr-1", "channel": 1, "enabled": 1}


def _live_settings(settings, monkeypatch):
    s = dataclasses.replace(settings_for(settings, auth="basic", go2rtc_source="rtsp"), go2rtc_url=f"http://{G2_HOST}:1984")
    monkeypatch.setattr("smplwise.recorder_scope.settings_for", lambda base, rid: s)
    monkeypatch.setattr("smplwise.mode.ensure_recorder_enabled", lambda rs: None)
    return s


def test_live_open_writes_the_stream_when_the_device_answers(settings, fake, g2api, monkeypatch):
    s = _live_settings(settings, monkeypatch)
    assert media.ensure_camera_stream(s, CAM, "sub") == STREAM
    assert g2api.store[STREAM] == [f"{BASE}/chID=1&streamType=sub1#backchannel=0"]


def test_live_open_keeps_the_existing_stream_when_the_device_read_fails(settings, fake, g2api, monkeypatch):
    s = _live_settings(settings, monkeypatch)
    kept = f"{BASE}/chID=1&streamType=sub1#backchannel=0"
    g2api.store[STREAM] = [kept]
    fake.down = True  # the NVR's HTTP server does not answer this moment (RTSP may still be fine)
    assert media.ensure_camera_stream(s, CAM, "sub") == STREAM
    assert g2api.store[STREAM] == [kept] and g2api.writes == []


def test_live_open_without_an_existing_stream_still_refuses(settings, fake, g2api, monkeypatch):
    s = _live_settings(settings, monkeypatch)
    fake.down = True
    with pytest.raises(ApiError) as exc:
        media.ensure_camera_stream(s, CAM, "sub")
    assert exc.value.code == "source_unavailable" and g2api.writes == []


@pytest.mark.parametrize("code", ["recorder_unavailable", "nvr_not_configured", "source_not_configured", "source_forbidden",
                                  "tls_pin_mismatch", "tls_pin_missing", "value_not_allowed"])
def test_non_transient_refusals_are_not_bypassed(settings, fake, g2api, monkeypatch, code):
    """A disabled recorder, a missing connection, a refused login or a changed certificate keep refusing the socket even when
    go2rtc still holds the stream."""
    s = _live_settings(settings, monkeypatch)
    g2api.store[STREAM] = [f"{BASE}/chID=1&streamType=sub1#backchannel=0"]

    def refuse(self, *a, **k):
        raise ApiError(503, code, "x")

    monkeypatch.setattr(vendor_io.LiveSources, "url", refuse)
    with pytest.raises(ApiError) as exc:
        media.ensure_camera_stream(s, CAM, "sub")
    assert exc.value.code == code


@pytest.mark.parametrize("code", sorted(media.LIVE_SOURCE_TRANSIENT))
def test_transient_codes_use_the_existing_stream(settings, fake, g2api, monkeypatch, code):
    s = _live_settings(settings, monkeypatch)
    g2api.store[STREAM] = [f"{BASE}/chID=1&streamType=sub1#backchannel=0"]

    def fail(self, *a, **k):
        raise ApiError(503, code, "x")

    monkeypatch.setattr(vendor_io.LiveSources, "url", fail)
    assert media.ensure_camera_stream(s, CAM, "sub") == STREAM and g2api.writes == []


def test_go2rtc_down_during_the_fallback_keeps_the_device_error(settings, fake, monkeypatch):
    s = _live_settings(settings, monkeypatch)
    fake.down = True

    def no_go2rtc(self):
        raise ApiError(503, "media_unavailable", "x")

    monkeypatch.setattr(g2.Go2rtc, "list_streams", no_go2rtc)
    with pytest.raises(ApiError) as exc:
        media.ensure_camera_stream(s, CAM, "sub")
    assert exc.value.code == "source_unavailable"
