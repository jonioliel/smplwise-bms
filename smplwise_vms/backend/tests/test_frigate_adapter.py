"""NN5 F1 - the Frigate adapter against the FAKE Frigate (invented values, real shapes): login and re-login, the GET allow-list,
scrubbing, capability discovery, the version gate, cameras with disabled state, health mapped into the CR-026 reading, the
analytics reads and the recording / playback reads. Nothing here talks to a real server."""
from __future__ import annotations

import dataclasses
import json
import sys
from pathlib import Path

import pytest

from smplwise.errors import ApiError
from smplwise.services.recorders import frigate as fr
from smplwise.services.recorders import frigate_http as fh

sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from fake_frigate import HOST, PASSWORD, PLANTED_PASSWORD, PLANTED_TOKEN_USER, T0, USER, FakeFrigate, settings_for  # noqa: E402


@pytest.fixture(autouse=True)
def _clean():
    fh.clear_cache()
    fr.clear_cache()
    yield
    fh.clear_cache()
    fr.clear_cache()


@pytest.fixture()
def fake() -> FakeFrigate:
    return FakeFrigate()


def adapter(settings, fake, **extra):
    return fr.FrigateAdapter("nvr-2", settings_for(settings, **extra), transport=fake.transport())


# ---------------------------------------------------------------------------------------------- session

def test_login_once_then_cookie_on_every_get(settings, fake):
    a = adapter(settings, fake)
    a.health()
    a.http.get_json("/api/stats")
    assert fake.logins == 1
    assert fake.non_get == ["POST /api/login"], "the login is the only non-GET request"


def test_an_expired_token_logs_in_again_once(settings, fake):
    a = adapter(settings, fake)
    a.health()
    fake.expire_after = fake.authed_requests  # the next authenticated request answers 401
    assert a.http.get_json("/api/stats")["cameras"]
    assert fake.logins == 2


def test_a_second_401_is_source_forbidden_and_starts_the_backoff(settings, fake):
    a = adapter(settings, fake)
    a.health()
    orig = fake._handle

    def always_401(request):
        if request.method == "GET" and request.url.path == "/api/stats":
            fake.hits.append("GET /api/stats")
            import httpx

            return httpx.Response(401)
        return orig(request)

    fake._handle = always_401
    with pytest.raises(ApiError) as e:
        a.http.get_json("/api/stats")
    assert e.value.code == "source_forbidden"
    logins = fake.logins
    with pytest.raises(ApiError) as e2:  # no login storm: the backoff answers locally
        a.http.get_json("/api/stats")
    assert e2.value.code == "source_forbidden" and fake.logins == logins


def test_wrong_credentials_are_source_forbidden_with_backoff(settings, fake):
    fake.login_ok = False
    a = adapter(settings, fake)
    h = a.health()
    assert (h.online, h.error) == (False, "source_forbidden")
    n = len(fake.hits)
    h2 = a.health()
    assert h2.error == "source_forbidden" and len(fake.hits) == n, "the second health read sends nothing (lockout guard)"


def test_unreachable_server_is_source_unavailable(settings, fake):
    fake.down = True
    h = adapter(settings, fake).health()
    assert (h.online, h.error) == (False, "source_unavailable")


def test_missing_credentials_are_source_not_configured(settings, fake):
    s = dataclasses.replace(settings_for(settings), nvr_password=None)
    with pytest.raises(ApiError) as e:
        fr.FrigateAdapter("nvr-2", s, transport=fake.transport()).http.get("/api/version")
    assert e.value.code == "source_not_configured"


# ---------------------------------------------------------------------------------------------- allow-list

@pytest.mark.parametrize("path", [
    "/api/events/summary",                      # 14 MB unfiltered
    "/api/config/set", "/api/config/raw_paths", "/api/exports", "/api/export/cam_front/start/1/end/2",
    "/api/cam_front/start/1/end/2/clip.mp4",   # the clip cut is design only
    "/api/users", "/api/restart", "/api/cam_front/ptz/info", "/ws", "/api/../etc/passwd", "/api/stats/history", "/vod/cam_front/start/1/end/2/../../x.m3u8",
    "/api/cam_front/recordings/1/snapshot.jpg/../../x", "/",
])
def test_paths_outside_the_allow_list_are_refused_before_any_byte(settings, fake, path):
    a = adapter(settings, fake)
    with pytest.raises(ApiError) as e:
        a.http.get(path)
    assert e.value.code == "frigate_path_not_allowed"
    assert fake.hits == [], "nothing was sent"


def test_unbounded_list_calls_are_refused(settings, fake):
    a = adapter(settings, fake)
    for path, params in (("/api/review", None), ("/api/events", {"after": "1"}), ("/api/review", {"limit": 100000}), ("/api/review", {"limit": 10, "evil": "1"})):
        with pytest.raises(ApiError) as e:
            a.http.get(path, params)
        assert e.value.code == "frigate_path_not_allowed"
    assert fake.hits == []


def test_a_normal_f1_session_sends_only_gets_and_one_login(settings, fake):
    a = adapter(settings, fake)
    a.discover(refresh=True)
    a.read_health()
    a.review_items(T0 - 2000, T0)
    a.recordings("cam_front", T0 - 600, T0)
    a.latest_jpeg("cam_front", 240)
    a.vod_playlist("cam_front", T0 - 600, T0)
    assert fake.non_get == ["POST /api/login"]
    assert all(h.startswith("GET ") or h == "POST /api/login" for h in fake.hits)


# ---------------------------------------------------------------------------------------------- scrubbing

def test_the_config_summary_carries_no_secret(settings, fake):
    a = adapter(settings, fake)
    doc = a.discover(refresh=True)
    blob = json.dumps(doc)
    for secret in (PLANTED_PASSWORD, PLANTED_TOKEN_USER, "192.0.2.10", "192.0.2.20", "rtsp://", "ffmpeg", "mqtt", "__FRIGATE_SAVED_CREDENTIAL__", PASSWORD, USER, HOST):
        assert secret not in blob, secret


def test_scrub_removes_user_info_secret_keys_and_command_lines():
    cfg = FakeFrigate().config()
    out = json.dumps(fh.scrub(cfg))
    assert PLANTED_PASSWORD not in out and PLANTED_TOKEN_USER not in out
    assert "ffmpeg_cmds" not in out
    assert fh.scrub_text("rtsp://u:p@host/x and http://a:b@c/") == "rtsp://***@host/x and http://***@c/"


def test_errors_never_carry_the_address_or_credentials(settings, fake):
    fake.down = True
    a = adapter(settings, fake)
    with pytest.raises(ApiError) as e:
        a.http.get_json("/api/stats")
    text = json.dumps({"code": e.value.code, "details": e.value.details, "message": e.value.user_message})
    assert HOST not in text and PASSWORD not in text and USER not in text


# ---------------------------------------------------------------------------------------------- discovery

def test_discovery_summary_and_features(settings, fake):
    a = adapter(settings, fake)
    doc = a.discover(refresh=True)
    assert doc["version"] == "0.18.0-77a66e7" and doc["version_ok"] and doc["routes_known"]
    cams = {c["key"]: c for c in doc["summary"]["cameras"]}
    assert set(cams) == {"cam_front", "cam_yard", "cam_garage"}
    assert cams["cam_front"]["name"] == "Front door" and cams["cam_front"]["ptz"] and cams["cam_front"]["zones"] == ["porch"] and cams["cam_front"]["labels"] == ["person", "car"]
    assert cams["cam_garage"]["enabled"] is False and cams["cam_yard"]["detect"]["width"] == 2560
    assert [d["name"] for d in doc["summary"]["detectors"]] == ["coral1", "coral2"]
    ret = doc["summary"]["retention"]
    assert (ret["continuous_days"], ret["motion_days"], ret["alerts_days"], ret["detections_days"], ret["pre_s"], ret["post_s"]) == (0, 10, 30, 30, 10, 15)
    f = doc["features"]
    assert f["review_items"] and f["object_events"] and f["recordings"] and f["hls_playback"] and f["search_semantic"] and f["search_text"] and f["timeline"]
    assert f["ptz"] and f["exports_native"] and f["runtime_toggles"] and f["config_write"], "discovered from the routes, not used in F1"
    assert not f["faces"] and not f["lpr"] and not f["genai"] and not f["restream"]


def test_capabilities_declare_discovered_features_and_no_writes(settings, fake):
    a = adapter(settings, fake)
    assert a.capabilities().features == frozenset(), "nothing is declared before a discovery"
    a.discover(refresh=True)
    caps = a.capabilities()
    assert caps.vendor == "frigate" and caps.playback == "hls" and caps.events == "push" and caps.health_detail
    assert not caps.write_encodings and not caps.add_channel and not caps.remove_channel
    assert caps.live == "none" and "review_items" in caps.features
    fake.restream = True
    a.discover(refresh=True)
    assert a.capabilities().live == "rtsp" and "restream" in a.capabilities().features


def test_without_openapi_the_routes_are_unknown_not_false(settings, fake):
    fake.openapi = False
    a = adapter(settings, fake)
    doc = a.discover(refresh=True)
    assert doc["routes_known"] is False
    assert doc["features"]["review_items"] is True and doc["features"]["search_text"] is False  # config decides what it can; the rest is not claimed


def test_a_viewer_who_cannot_read_openapi_still_discovers(settings, fake):
    fake.viewer_blocks = {"/api/openapi.json"}
    doc = adapter(settings, fake).discover(refresh=True)
    assert doc["routes_known"] is False and doc["summary"]["cameras"]


def test_a_viewer_who_cannot_read_config_is_forbidden_with_a_clear_code(settings, fake):
    fake.viewer_blocks = {"/api/config"}
    with pytest.raises(ApiError) as e:
        adapter(settings, fake).discover(refresh=True)
    assert e.value.code == "source_forbidden"


def test_version_below_the_minimum_is_not_usable(settings, fake):
    fake.version = "0.16.2-abc"
    a = adapter(settings, fake)
    h = a.health()
    assert (h.online, h.error, h.firmware) == (False, "nvr_not_supported", "0.16.2-abc")
    assert a.discover(refresh=True)["version_ok"] is False
    with pytest.raises(ApiError) as e:
        a.cameras()
    assert e.value.code == "frigate_version_unsupported"
    assert [v for v in (fr.parse_version("0.18.0-77a66e7"), fr.parse_version("0.18"), fr.parse_version("1.0.0"))] == [(0, 18, 0), (0, 18), (1, 0, 0)]
    assert fr.parse_version("<html>") is None and not fr.version_ok(None) and fr.version_ok((0, 18)) and not fr.version_ok((0, 17, 9))


def test_a_non_frigate_answer_is_source_invalid(settings, fake):
    fake.version = "<html>login</html>"
    assert adapter(settings, fake).health().error == "source_invalid"


def test_cameras_list_with_enabled_state_and_stable_channels(settings, fake):
    a = adapter(settings, fake)
    cams = {c["key"]: c for c in a.cameras()}
    assert [cams[k]["channel"] for k in ("cam_front", "cam_yard", "cam_garage")] == [1, 2, 3]
    assert cams["cam_front"]["online"] is True and cams["cam_garage"]["enabled"] is False and cams["cam_garage"]["online"] is None
    a.channel_map = {"cam_yard": 7}
    a2 = {c["key"]: c["channel"] for c in a.cameras()}
    assert a2["cam_yard"] == 7 and a2["cam_front"] == 1 and a2["cam_garage"] == 2, "an assigned channel is kept; new ones take the next free number"
    ch = a.list_channels()
    assert [c.source_ref for c in ch] == ["cam_front", "cam_yard", "cam_garage"]


def test_encoding_facts_and_no_writes(settings, fake):
    a = adapter(settings, fake)
    enc = a.read_stream_encodings()
    assert enc["cam_yard"][0].encoding == {"resolution": "2560x1440", "fps": 5.0}
    assert a.stream_options("detect").writable is False and a.stream_options("detect").reason == "frigate_does_not_own_the_encoder"
    for fn in (lambda: a.read_stream("detect"), lambda: a.write_stream_encoding("detect", "e", "<x/>", "direct")):
        with pytest.raises(ApiError) as e:
            fn()
        assert e.value.code == "nvr_not_supported"
    assert fake.non_get == ["POST /api/login"]


# ---------------------------------------------------------------------------------------------- health

def test_health_reading_maps_into_the_cr026_model(settings, fake):
    a = adapter(settings, fake)
    h = a.health()
    assert h.online and h.model == "Frigate" and h.firmware == "0.18.0-77a66e7" and h.clock_drift_s is not None
    r = a.read_health()
    assert [(d.ref, d.state, d.total_mb, d.free_mb) for d in r.disks] == [("1", "ok", 1_000_000, 600_000)], "the recordings mount only (not cache / shm)"
    ch = {c.channel: (c.connected, c.record_state) for c in r.channels}
    assert ch == {1: (True, "recording"), 2: (True, "recording")}, "a camera disabled in Frigate is not watched"
    d = r.details
    assert [x["name"] for x in d["detectors"]] == ["coral1", "coral2"] and d["detectors"][0]["inference_ms"] == 8.5
    assert d["storage"]["bandwidth_mb_per_h"] == 200.0 and d["storage"]["hours_left"] == 3000.0
    assert d["recording_policy"]["motion_days"] == 10 and d["skipped_fps_total"] == 0
    assert not r.errors and r.certificate is None


def test_a_camera_without_frames_is_disconnected_and_detector_overload_is_visible(settings, fake):
    fake.stats_fps["cam_yard"] = 0.0
    a = adapter(settings, fake)
    r = a.read_health()
    ch = {c.channel: (c.connected, c.record_state) for c in r.channels}
    assert ch[2] == (False, None)


def test_health_part_failures_are_named_not_fatal(settings, fake):
    fake.viewer_blocks = {"/api/recordings/storage"}
    r = adapter(settings, fake).read_health()
    assert r.disks and r.channels and r.details["storage"]["hours_left"] is None


def test_health_stops_when_the_server_refuses(settings, fake):
    a = adapter(settings, fake)
    a.health()
    fake.viewer_blocks = {"/api/stats"}
    with pytest.raises(ApiError) as e:
        a.read_health()
    assert e.value.code == "source_forbidden"


def test_health_flows_through_the_recorder_health_poller(settings, fake):
    from smplwise.services import recorder_health as rh

    rh.reset()
    a = adapter(settings, fake)
    a.discover(refresh=True)
    a.channel_map = {"cam_front": 1, "cam_yard": 2}
    st = rh.probe("nvr-2", "Frigate", "frigate", a)
    assert st.reachable and st.detail_supported and st.reading.disks and st.model == "Frigate"
    view = rh._recorder_view(st, rh.thresholds_default() if hasattr(rh, "thresholds_default") else {k: v[0] for k, v in rh.THRESHOLDS.items()}, rh._now_ts(), {}, "Frigate")
    assert view["vendor_details"]["detectors"][0]["name"] == "coral1" and view["disks"]["state"] == "ok"
    rh.reset()


def test_certificate_facts_only_for_pinned_https(settings, fake, monkeypatch):
    pin = "ab" * 32
    got = []
    monkeypatch.setattr(fr, "PEER_CERTIFICATE_HOOK", lambda host, port, timeout: got.append(port) or {"not_after": "2027-01-01T00:00:00Z", "self_signed": True})
    plain = adapter(settings, fake)
    assert plain.certificate_facts() is None
    pinned = adapter(settings, fake, scheme="https", tls_mode="pin", tls_pin=pin)
    assert pinned.certificate_facts() == {"not_after": "2027-01-01T00:00:00Z", "self_signed": True}
    assert pinned.certificate_facts() and got == [8971], "cached: one handshake"


def test_tls_pin_mode_without_a_pin_refuses_before_any_request(settings, fake):
    a = fr.FrigateAdapter("nvr-2", settings_for(settings, scheme="https", tls_mode="pin"), transport=fake.transport())
    assert a.health().error == "tls_pin_missing"
    assert fake.hits == []


def test_warnings_for_plain_http_and_trust(settings, fake):
    codes = lambda **x: [w["code"] for w in adapter(settings, fake, **x).http.warnings()]  # noqa: E731
    assert "frigate_plain_http" in codes()
    assert codes(scheme="https", tls_mode="trust") == ["tls_trust_any"]
    assert codes(scheme="https", tls_mode="pin", tls_pin="cd" * 32) == []


# ---------------------------------------------------------------------------------------------- analytics and media reads

def test_review_items_and_events_reads(settings, fake):
    a = adapter(settings, fake)
    items = a.review_items(T0 - 2000, T0 + 60)
    assert [i["id"][:12] for i in items] == ["1791227900.3", "1791227500.2", "1791227000.1"]
    assert [i["severity"] for i in a.review_items(T0 - 2000, T0 + 60, severity="alert")] == ["alert", "alert"]
    assert a.review_item("1791227500.200000-bbb222")["camera"] == "cam_yard"
    with pytest.raises(ApiError) as e:
        a.review_item("1791227500.999999-zzz999")
    assert e.value.code == "not_found"
    assert a.events(T0 - 100, T0) == []
    assert len(a.motion_activity(T0 - 600, T0)) == 10


def test_pictures_come_back_as_bytes_with_a_type(settings, fake):
    a = adapter(settings, fake)
    data, ctype = a.latest_jpeg("cam_front", 240)
    assert data.startswith(b"\xff\xd8") and ctype == "image/jpeg" and data.endswith(b"h240")
    data, ctype = a.review_thumbnail("cam_front", "1791227000.100000-aaa111")
    assert ctype == "image/webp" and data.startswith(b"RIFF")
    with pytest.raises(ApiError) as e:
        a.review_thumbnail("cam_front", "1791220000.000000-nope00")
    assert e.value.code == "not_found"
    with pytest.raises(ApiError) as e2:
        a.latest_jpeg("../etc", None)
    assert e2.value.code == "camera_invalid"


def test_a_non_image_answer_is_refused(settings, fake):
    orig = fake._handle

    def html(request):
        r = orig(request)
        if request.url.path.endswith("latest.jpg"):
            import httpx

            return httpx.Response(200, content=b"<html>", headers={"content-type": "text/html"})
        return r

    fake._handle = html
    with pytest.raises(ApiError) as e:
        adapter(settings, fake).latest_jpeg("cam_front")
    assert e.value.code == "source_invalid"


def test_size_caps_apply(settings, fake, monkeypatch):
    monkeypatch.setattr(fr, "IMAGE_MAX_BYTES", 10)
    with pytest.raises(ApiError) as e:
        adapter(settings, fake).latest_jpeg("cam_front")
    assert e.value.code == "source_too_large"


def test_recordings_playlist_and_assets(settings, fake):
    a = adapter(settings, fake)
    segs = a.recordings("cam_front", T0 - 600, T0)
    assert len(segs) >= 20 and segs[0]["start_time"] >= T0 - 610
    text = a.vod_playlist("cam_front", T0 - 600, T0)
    assert text.startswith("#EXTM3U") and "seg-1-v1.m4s" in text
    body, ctype = a.vod_asset("cam_front", T0 - 600, T0, "seg-1-v1.m4s")
    assert body and ctype.startswith("video/")
    assert a.recordings_summary("cam_front", "Asia/Jerusalem")[0]["day"] == "2026-10-05"
    assert a.storage_usage()["cam_front"]["bandwidth"] == 120.0


def test_clock_drift_from_the_date_header(settings, fake, monkeypatch):
    import time as _t

    monkeypatch.setattr(_t, "time", lambda: 1791223203.0 + 7)  # the host is 7 s ahead of the fake's Date (18:00:03 GMT)
    fake.date_header = "Mon, 05 Oct 2026 18:00:03 GMT"
    drift = adapter(settings, fake).version()[2]
    assert drift is not None and -3600 * 10 < drift < 3600 * 10
