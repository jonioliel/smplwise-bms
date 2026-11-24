"""ONVIF-CLIENT-2500: the fuller ONVIF client of camera discovery (services/camera_discovery/onvif_client.py) and the ONVIF-API parts
that needed it - the add step (`POST /cameras/discovery/scans/{id}/add` over `camera_sources.create_standalone`), the preview form
of `POST /cameras/source/test` and migration 0217 (`camera_stream_sources.origin` / `onvif_json`). Design
docs/design/onvif-discovery-2412 sections 4.2, 4.3, 4.5, 6, 7, 8, 9; owner decisions 2026-11-22 Q57-Q59.

No real network: the fake ONVIF devices of tests/fixtures/fake_onvif.py (UDP transport + httpx.MockTransport, now with HTTP Digest,
GetServices / GetCapabilities and Media1 / Media2) and the fake go2rtc of tests/test_camera_sources_2410.py. Addresses are a made-up
RFC 1918 network (10.77.0.0/24); users, passwords and serials are made up, and every test that carries one greps the answers, the
audit log, the captured log and the database for it."""
from __future__ import annotations

import ipaddress
import json
import logging
import sqlite3
import sys
import time
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace

import httpx
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))

from conftest import as_user, make_client  # noqa: E402
from fake_onvif import FakeNetwork, FakeOnvifDevice, hik_scopes  # noqa: E402
from support.audit import audit_details, audit_rows  # noqa: E402
from test_camera_sources_2410 import FakeGo2rtc  # noqa: E402

from smplwise.db import Database, set_setting  # noqa: E402
from smplwise.services import camera_sources as cs  # noqa: E402
from smplwise.services import connection_store  # noqa: E402
from smplwise.services import go2rtc as g2  # noqa: E402
from smplwise.services import source_policy as sp  # noqa: E402
from smplwise.services.camera_discovery import known, onvif_client as oc, onvif_http, ranges, service as svc  # noqa: E402

API = "/api/v1/cameras/discovery"
GO2RTC = "http://go2rtc.test:1984"
RANGE = "10.77.0.64/27"
HOST = "10.77.0.10/24"
USER, PASSWORD, WRONG = "onvif-op-77", "Cam:Pass#1/x", "Wrong-Pass-9"
SERIALS = ("FAKESERIAL0001", "FAKESERIAL0002", "NVRSERIAL0009", "FAKESERIAL0004", "FAKESERIAL0005")
SECRETS = (PASSWORD, WRONG, "Cam%3APass%231%2Fx", *SERIALS)
ENVELOPE = {"code", "user_message", "retryable", "correlation_id", "details"}


def media2_profiles() -> list[dict]:
    return [{"token": "MainH265", "name": "main", "encoding": "H265", "width": 3840, "height": 2160, "fps": 20},
            {"token": "Sub", "name": "sub", "encoding": "H264", "width": 704, "height": 576, "fps": 12},
            {"token": "Tiny", "name": "third", "encoding": "H264", "width": 176, "height": 144, "fps": 5}]


def fleet() -> list[FakeOnvifDevice]:
    return [
        # Hikvision-like: Media1 + Media2
        FakeOnvifDevice("10.77.0.71", "urn:uuid:aaaaaaaa-0000-4000-8000-000000000071", scopes=hik_scopes("DS-2CD2387G2"), serial=SERIALS[0],
                        media2=True, profiles=media2_profiles()),
        # Dahua-like: Media1 only, no GetServices, HTTP Digest only
        FakeOnvifDevice("10.77.0.72", "urn:uuid:aaaaaaaa-0000-4000-8000-000000000072", scopes=hik_scopes("IPC-HDW2431T", "Dahua IPC-HDW2431T"),
                        manufacturer="Dahua", model="IPC-HDW2431T", serial=SERIALS[1], services=False, digest_only=True,
                        stream_uris={"Profile_1": "rtsp://10.77.0.72:554/cam/realmonitor?channel=1&subtype=0",
                                     "Profile_2": "rtsp://10.77.0.72:554/cam/realmonitor?channel=1&subtype=1"}),
        FakeOnvifDevice("10.77.0.80", "urn:uuid:aaaaaaaa-0000-4000-8000-000000000080", scopes=hik_scopes("DS-7608NI-K2"), model="DS-7608NI-K2",
                        serial=SERIALS[2]),  # a recorder (Q59)
        FakeOnvifDevice("10.77.0.74", "urn:uuid:aaaaaaaa-0000-4000-8000-000000000074", scopes=hik_scopes("DS-2CD1023G0"), serial=SERIALS[3]),  # behind the recorder
        FakeOnvifDevice("10.77.0.76", "urn:uuid:aaaaaaaa-0000-4000-8000-000000000076", scopes=hik_scopes("DS-2CD1043G0"), serial=SERIALS[4],
                        stream_host="10.77.0.200"),  # streams on another host
    ]


class Guard:
    def __init__(self, allow: bool = True) -> None:
        self.allowed, self.refusals, self.asked = allow, 0, 0

    def allow(self) -> bool:
        self.asked += 1
        return self.allowed

    def refused(self) -> None:
        self.refusals += 1


def client_for(monkeypatch, *devs: FakeOnvifDevice) -> tuple[FakeNetwork, oc.OnvifClient]:
    for d in devs:
        d.username = USER
        d.password = PASSWORD
    net = FakeNetwork(list(devs))
    monkeypatch.setattr(onvif_http, "TRANSPORT", net.transport())
    return net, oc.OnvifClient()


def press(client: oc.OnvifClient, dev: FakeOnvifDevice, password: str = PASSWORD, guard: Guard | None = None) -> oc.Identified:
    t = onvif_http.Target(dev.address, 80)
    clk = client.clock(t)
    return client.information(t, USER, password, clk.offset_s if clk else None, guard or Guard())


def no_secret(text: str, where: str) -> None:
    for s in SECRETS:
        assert s not in text, f"{s!r} {where}"


# ================================================================ the SOAP builder: golden shapes, closed list

def test_the_request_bodies_are_fixed_templates():
    body = onvif_http.envelope("GetStreamUri", service="media", token="Profile_1").decode()
    assert ("<trt:GetStreamUri><trt:StreamSetup><tt:Stream>RTP-Unicast</tt:Stream><tt:Transport><tt:Protocol>RTSP</tt:Protocol></tt:Transport>"
            "</trt:StreamSetup><trt:ProfileToken>Profile_1</trt:ProfileToken></trt:GetStreamUri>") in body
    assert 'xmlns:trt="http://www.onvif.org/ver10/media/wsdl"' in body
    body = onvif_http.envelope("GetStreamUri", service="media2", token="MainH265").decode()
    assert "<tr2:GetStreamUri><tr2:Protocol>RTSP</tr2:Protocol><tr2:ProfileToken>MainH265</tr2:ProfileToken></tr2:GetStreamUri>" in body
    assert "<tr2:GetProfiles><tr2:Type>VideoEncoder</tr2:Type></tr2:GetProfiles>" in onvif_http.envelope("GetProfiles", service="media2").decode()
    assert "<trt:GetProfiles/>" in onvif_http.envelope("GetProfiles", service="media").decode()
    assert "<tds:GetServices><tds:IncludeCapability>false</tds:IncludeCapability></tds:GetServices>" in onvif_http.envelope("GetServices").decode()
    assert "<tr2:GetSnapshotUri><tr2:ProfileToken>A</tr2:ProfileToken></tr2:GetSnapshotUri>" in onvif_http.envelope("GetSnapshotUri", service="media2", token="A").decode()


@pytest.mark.parametrize("action, service, token", [
    ("GetProfiles", "device", None), ("GetDeviceInformation", "media", None), ("SetVideoEncoderConfiguration", "media", None),
    ("CreateProfile", "media2", None), ("DeleteProfile", "media2", "A"), ("SetSynchronizationPoint", "media", None), ("GetStreamUri", "media", None),
    ("GetProfiles", "media", "A"), ("GetStreamUri", "media", "A</trt:ProfileToken><trt:x>"), ("GetStreamUri", "media2", "x" * 65),
    ("GetStreamUri", "media2", ""), ("GetSnapshotUri", "media", " A"), ("GetProfiles", "imaging", None), ("GetStreamUri", "media", "a&b"),
])
def test_nothing_outside_the_closed_list_can_be_built(action, service, token):
    with pytest.raises(ValueError):
        onvif_http.envelope(action, service=service, token=token)


# ================================================================ HTTP Digest (RFC 7616)

def test_the_digest_answer_matches_the_rfc_7616_example():
    """RFC 7616 section 3.9.1: Mufasa / "Circle of Life", qop=auth, nc=00000001."""
    raw = ('Digest realm="http-auth@example.org", qop="auth, auth-int", algorithm=SHA-256, '
           'nonce="7ypf/xlj9XXwfDPEoM4URrv/xwf94BcCAzFZH4GiTo0v", opaque="FQhe/qaU925kfnzjCev0ciny7QMkPqMAFRtzCUYo5tdS", '
           'Digest realm="http-auth@example.org", qop="auth, auth-int", algorithm=MD5, nonce="7ypf/xlj9XXwfDPEoM4URrv/xwf94BcCAzFZH4GiTo0v", '
           'opaque="FQhe/qaU925kfnzjCev0ciny7QMkPqMAFRtzCUYo5tdS"')
    sha = oc.parse_challenge(raw)
    assert (sha.algorithm, sha.qop, sha.realm) == ("SHA-256", "auth", "http-auth@example.org")
    cnonce = "f2/wE4q74E6zIJEtWaHKaf5wv/H5QzzpXusqGemxURZJ"
    head = oc.digest_authorization(sha, "GET", "/dir/index.html", "Mufasa", "Circle of Life", 1, cnonce)
    assert 'response="753927fa0e85d155564e2e272a28d1802ca10daf4496794697cf8db5856cb6c1"' in head
    md5 = oc.Challenge(realm=sha.realm, nonce=sha.nonce, algorithm="MD5", qop="auth", opaque=sha.opaque)
    head = oc.digest_authorization(md5, "GET", "/dir/index.html", "Mufasa", "Circle of Life", 1, cnonce)
    assert 'response="8ca523f5e9506fed4657c9700eebdbec"' in head and "nc=00000001" in head and 'opaque="FQhe' in head


@pytest.mark.parametrize("raw, ok", [
    ('Digest realm="cam", nonce="n1", qop="auth"', True),
    ('Basic realm="cam", Digest realm="cam", nonce="n1"', True),
    ('Digest realm="cam", nonce="n1", qop="auth-int"', False),  # auth-int only: not answered
    ('Digest realm="cam", qop="auth"', False),  # no nonce
    ('Digest realm="cam", nonce="n1", algorithm=SHA-512-256', False),
    ('Basic realm="cam"', False),
    ('Digest realm="cam", nonce="' + "n" * 300 + '"', False),
    (None, False),
])
def test_challenges_this_client_answers(raw, ok):
    assert (oc.parse_challenge(raw) is not None) is ok


# ================================================================ stream addresses for the camera-source model

@pytest.mark.parametrize("uri, want", [
    ("rtsp://10.77.0.71:554/Streaming/Channels/101?transportmode=unicast", ("rtsp://10.77.0.71:554/Streaming/Channels/101?transportmode=unicast", "ok")),
    ("rtsp://admin:secret@10.77.0.71/h264Preview_01_main", ("rtsp://10.77.0.71/h264Preview_01_main", "ok")),  # user info removed
    ("RTSPS://10.77.0.71:322/x", ("rtsps://10.77.0.71:322/x", "ok")),
    ("rtsp://10.77.0.99:554/x", (None, "other_host")),
    ("rtsp://camera.local/x", (None, "other_host")),  # a name is never followed
    ("rtsp://127.0.0.1:554/x", (None, "other_host")),
    ("http://10.77.0.71/x", (None, "not_rtsp")),
    ("rtsp://10.77.0.71/x#backchannel=1", (None, "bad_shape")),
    ("rtsp://10.77.0.71/x?src=door-1", (None, "bad_shape")),
    ("rtsp://10.77.0.71/x y", (None, "bad_shape")),
    ("rtsp://10.77.0.71/" + "a" * 600, (None, "bad_shape")),
    ("rtsp://10.77.0.71/א", (None, "bad_shape")),
    ("rtsp://10.77.0.71:99999/x", (None, "bad_shape")),
    (None, (None, "bad_shape")),
])
def test_stream_addresses_are_shaped_and_kept_to_the_camera(uri, want):
    assert oc.shape_stream(uri, "10.77.0.71") == want


def test_the_credentials_go_in_percent_encoded_and_the_policy_accepts_the_result():
    src = oc.with_credentials("rtsp://10.77.0.71:554/Streaming/Channels/101", "op@site", "p:a#s/s?w%rd")
    assert src == "rtsp://op%40site:p%3Aa%23s%2Fs%3Fw%25rd@10.77.0.71:554/Streaming/Channels/101"
    assert sp.source_refusal(src) is None
    assert cs.mask(src)[0] == "rtsp://op%40site:***@10.77.0.71:554/Streaming/Channels/101"


def test_main_and_sub_are_suggested_by_resolution_and_codec():
    def prof(token, codec, w, h, uri=True):
        return oc.Profile(token, None, codec, w, h, 25, uri=f"rtsp://10.77.0.71/{token}" if uri else None, stream="ok" if uri else "other_host")
    main, sub = oc.suggest([prof("a", "h264", 1920, 1080), prof("b", "h265", 3840, 2160), prof("c", "h264", 640, 360), prof("d", "h264", 176, 144)])
    assert (main.token, sub.token) == ("b", "c")
    main, sub = oc.suggest([prof("a", "h264", 1920, 1080)])
    assert (main.token, sub) == ("a", None)  # one address serves both
    main, sub = oc.suggest([prof("m", "mjpeg", 1280, 720), prof("t", "mjpeg", 320, 240)])
    assert (main.token, sub.token) == ("m", "t")  # only MJPEG: still offered (go2rtc handles it)
    assert oc.suggest([prof("x", "h264", 1920, 1080, uri=False)]) == (None, None)


def test_hostile_profile_lists_are_bounded():
    profs = "".join(f'<trt:Profiles token="{t}"><tt:Name>n</tt:Name><tt:VideoEncoderConfiguration><tt:Encoding>H264</tt:Encoding>'
                    f'<tt:Resolution><tt:Width>{w}</tt:Width><tt:Height>10</tt:Height></tt:Resolution></tt:VideoEncoderConfiguration></trt:Profiles>'
                    for t, w in [("ok1", 100), ("bad&lt;token&gt;", 100), ("ok1", 200), ("", 1), ("huge", 99999999)] + [(f"p{i}", 10) for i in range(20)])
    profs += '<trt:Profiles token="audio"><tt:Name>audio only</tt:Name></trt:Profiles>'
    root = onvif_http._parse(f'<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:trt="x" xmlns:tt="y"><s:Body>'
                             f"<trt:GetProfilesResponse>{profs}</trt:GetProfilesResponse></s:Body></s:Envelope>".encode())
    got = oc.parse_profiles(root, "media")
    assert len(got) == oc.MAX_PROFILES and got[0].token == "ok1" and [p.token for p in got].count("ok1") == 1
    assert got[1].token == "huge" and got[1].width is None  # out of range: not believed
    assert "audio" not in [p.token for p in got]


# ================================================================ the client against fake cameras

def test_media2_first_one_credential_request_then_the_media_reads(monkeypatch, caplog):
    caplog.set_level(logging.DEBUG)
    dev = fleet()[0]
    net, client = client_for(monkeypatch, dev)
    g = Guard()
    info = press(client, dev, guard=g)
    assert (info.auth, info.auth_mode, info.media, info.manufacturer) == ("ok", "wsse", "media2", "HIKVISION")
    assert [(p.token, p.codec, p.width, p.stream) for p in info.profiles] == [("MainH265", "h265", 3840, "ok"), ("Sub", "h264", 704, "ok"),
                                                                             ("Tiny", "h264", 176, "ok")]
    assert info.profiles[0].uri == "rtsp://10.77.0.71:554/Streaming/Channels/101?transportmode=unicast"
    assert info.snapshot_uri == "http://10.77.0.71/onvif-http/snapshot?Profile_1"
    assert [(s, a) for s, a, _m in dev.calls] == [("device", "GetSystemDateAndTime"), ("device", "GetDeviceInformation"), ("device", "GetServices"),
                                                  ("media2", "GetProfiles"), ("media2", "GetStreamUri"), ("media2", "GetStreamUri"),
                                                  ("media2", "GetStreamUri"), ("media2", "GetSnapshotUri")]
    assert {m for _s, a, m in dev.calls if a != "GetSystemDateAndTime"} == {"wsse"}
    assert dev.auth_requests == 1 and dev.failures == 0 and g.refusals == 0 and info.refusals == 0
    assert all(a.startswith("Get") for a in dev.actions)
    no_secret(repr(info) + caplog.text, "in the client's result or log")


def test_media1_through_get_capabilities_and_http_digest_once(monkeypatch):
    dev = fleet()[1]  # Dahua-like: no GetServices, Media1 only, HTTP Digest only
    net, client = client_for(monkeypatch, dev)
    g = Guard()
    info = press(client, dev, guard=g)
    assert (info.auth, info.auth_mode, info.media) == ("ok", "digest", "media")
    assert info.profiles[0].uri == "rtsp://10.77.0.72:554/cam/realmonitor?channel=1&subtype=0"
    gdi = [m for _s, a, m in dev.calls if a == "GetDeviceInformation"]
    assert gdi == ["wsse", "digest"]  # the WS-Security attempt, then the camera's own Digest challenge answered ONCE
    assert [a for _s, a, _m in dev.calls][3:6] == ["GetServices", "GetCapabilities", "GetProfiles"]
    assert {m for _s, a, m in dev.calls[3:]} == {"digest"}
    assert g.refusals == 1 and g.asked == 1 and dev.failures == 0  # the 401 counts toward the guard; the camera saw no failed login


def test_http_digest_wrong_password_is_two_refusals_and_stops(monkeypatch):
    dev = fleet()[1]
    net, client = client_for(monkeypatch, dev)
    g = Guard()
    info = press(client, dev, password=WRONG, guard=g)
    assert (info.auth, info.profiles, info.auth_mode) == ("wrong_password", [], None) and info.failed_auth
    assert [a for _s, a, _m in dev.calls] == ["GetSystemDateAndTime", "GetDeviceInformation", "GetDeviceInformation"]
    assert g.refusals == 2 and dev.failures == 1


def test_the_digest_answer_is_not_sent_when_the_guard_is_full(monkeypatch):
    dev = fleet()[1]
    net, client = client_for(monkeypatch, dev)
    info = press(client, dev, guard=Guard(allow=False))
    assert info.auth == "locked_guard" and not info.failed_auth
    assert [m for _s, a, m in dev.calls if a == "GetDeviceInformation"] == ["wsse"]


def test_sha256_digest_and_a_stale_nonce_is_renewed_not_counted(monkeypatch):
    dev = fleet()[1]
    dev.digest_algorithm, dev.stale_after = "SHA-256", 2
    net, client = client_for(monkeypatch, dev)
    g = Guard()
    info = press(client, dev, guard=g)
    assert info.auth == "ok" and info.auth_mode == "digest" and info.profiles[0].uri
    assert g.refusals == 1 and dev.failures == 0  # only the first WS-Security 401


def test_an_unanswerable_challenge_is_digest_required(monkeypatch):
    dev = fleet()[1]
    net, client = client_for(monkeypatch, dev)
    real = net.http

    def handler(request):
        r = real(request)
        if r.status_code == 401:
            return httpx.Response(401, headers={"WWW-Authenticate": 'Digest realm="x", nonce="n", qop="auth-int"'})
        return r

    monkeypatch.setattr(onvif_http, "TRANSPORT", httpx.MockTransport(handler))
    info = press(client, dev)
    assert info.auth == "digest_required" and [m for _s, a, m in dev.calls if a == "GetDeviceInformation"] == ["wsse"]


def test_a_camera_that_does_not_check_device_information_is_caught_at_the_media_reads(monkeypatch):
    dev = fleet()[0]
    dev.info_open = True
    net, client = client_for(monkeypatch, dev)
    g = Guard()
    info = press(client, dev, password=WRONG, guard=g)
    assert (info.auth, info.profiles, info.media) == ("wrong_password", [], "none")
    assert g.refusals == 1 and [a for _s, a, _m in dev.calls][-1] == "GetServices"  # stopped at the first refusal


def test_an_account_without_the_media_right(monkeypatch):
    dev = fleet()[0]
    dev.media_refused = True
    net, client = client_for(monkeypatch, dev)
    info = press(client, dev)
    assert info.auth == "wrong_password" and info.profiles == [] and dev.calls[-1][1] == "GetProfiles"


def test_a_media_service_on_another_host_is_never_contacted(monkeypatch):
    dev = fleet()[0]
    dev.media_host = "10.77.0.250"
    net, client = client_for(monkeypatch, dev)
    info = press(client, dev)
    assert (info.auth, info.media, info.profiles) == ("ok", "none", [])
    assert {h for h, _a in net.http_requests} == {"10.77.0.71"}


def test_streams_on_another_host_are_refused(monkeypatch):
    dev = fleet()[4]
    net, client = client_for(monkeypatch, dev)
    info = press(client, dev)
    assert info.auth == "ok" and {p.stream for p in info.profiles} == {"other_host"} and all(p.uri is None for p in info.profiles)
    assert oc.suggest(info.profiles) == (None, None)


def test_media2_without_a_usable_stream_falls_back_to_media1(monkeypatch):
    dev = fleet()[0]
    net, client = client_for(monkeypatch, dev)
    real = net.http

    def handler(request):
        if request.url.path == "/onvif/Media2" and b"GetStreamUri" in request.content:
            return httpx.Response(200, content=b'<?xml version="1.0"?><s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"><s:Body>'
                                               b'<GetStreamUriResponse><Uri>http://10.77.0.71/not-rtsp</Uri></GetStreamUriResponse></s:Body></s:Envelope>')
        return real(request)

    monkeypatch.setattr(onvif_http, "TRANSPORT", httpx.MockTransport(handler))
    info = press(client, dev)
    assert info.media == "media" and info.profiles[0].stream == "ok"


def test_the_requests_of_one_press_are_capped(monkeypatch):
    dev = fleet()[0]
    dev.profiles = [{"token": f"P{i}", "name": "n", "encoding": "H264", "width": 100 + i, "height": 100, "fps": 10} for i in range(12)]
    net, client = client_for(monkeypatch, dev)
    info = press(client, dev)
    assert len(info.profiles) == oc.MAX_PROFILES
    assert sum(a == "GetStreamUri" for a in dev.actions) == oc.MAX_STREAM_READS
    assert info.requests <= oc.MAX_REQUESTS and {p.stream for p in info.profiles} == {"ok", "not_read"}


def test_hostile_media_answers(monkeypatch):
    dev = fleet()[0]
    net, client = client_for(monkeypatch, dev)
    real = net.http

    def handler(request):
        if request.url.path == "/onvif/Media2" and b"GetProfiles" in request.content:
            return httpx.Response(200, content=b'<?xml version="1.0"?><!DOCTYPE a [<!ENTITY b "c">]><a>&b;</a>')
        if request.url.path == "/onvif/Media" and b"GetProfiles" in request.content:
            return httpx.Response(200, content=b"<a>" + b"x" * (onvif_http.MAX_BYTES + 10) + b"</a>")
        return real(request)

    monkeypatch.setattr(onvif_http, "TRANSPORT", httpx.MockTransport(handler))
    info = press(client, dev)
    assert (info.auth, info.media, info.profiles) == ("ok", "none", [])


# ================================================================ through the scan job and the routes

@pytest.fixture()
def env(settings, monkeypatch):
    s = replace(settings, go2rtc_url=GO2RTC)
    client = make_client(s)
    assert client.get("/api/v1/me").status_code == 200  # joni: the bootstrap system administrator
    devs = fleet()
    for d in devs:
        d.username, d.password = USER, PASSWORD
    net = FakeNetwork(devs)
    m = svc.MANAGER
    m.transport_factory = net
    m.run_inline = True
    m.listen_s = 0.05
    m.resolve = lambda name: []
    monkeypatch.setattr(onvif_http, "TRANSPORT", net.transport())
    monkeypatch.setattr(ranges, "SITE_INTERFACES", lambda _s: [ipaddress.ip_interface(HOST)])
    go = FakeGo2rtc()
    real = httpx.Client

    def factory(**kw):
        if str(kw.get("base_url", "")).rstrip("/") == GO2RTC:
            return real(transport=httpx.MockTransport(go.handler), **kw)
        return real(**kw)

    monkeypatch.setattr(g2.httpx, "Client", factory)
    monkeypatch.setattr(sp, "resolve_host", lambda host, timeout=2.0: ["192.0.2.10"] if host == "go2rtc.test" else [])
    sp._RESOLVED.clear()
    sp._RESOLVED["go2rtc.test"] = (time.monotonic(), frozenset({"192.0.2.10"}))
    cs.reset_health()
    cs._TESTS.clear()
    db = Database(s.db_path)
    with db.connection() as conn:
        set_setting(conn, svc.K_RATE, "200")
        set_setting(conn, known.FINGERPRINT_SALT_KEY, "salt-onvif-client-test")
    known.note_channel_hosts("nvr-1", ["10.77.0.74"])
    yield SimpleNamespace(c=client, net=net, db=db, settings=s, m=m, go=go, app=client.app)
    cs.reset_health()


def scan_and_identify(env, addrs=("10.77.0.71", "10.77.0.72", "10.77.0.74", "10.77.0.76", "10.77.0.80")) -> tuple[dict, dict]:
    job = env.c.post(f"{API}/scans", json={"range": RANGE}).json()
    ids = {d["address"]: d["id"] for d in job["devices"]}
    r = env.c.post(f"{API}/scans/{job['id']}/identify", json={"device_ids": [ids[a] for a in addrs], "username": USER, "password": PASSWORD,
                                                             "same_for_all": True})
    assert r.status_code == 200, r.text
    return job, {d["address"]: d for d in r.json()["devices"]}


def db_dump(env) -> str:
    with env.db.connection(mode="read") as conn:
        out = []
        for (name,) in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'").fetchall():
            try:
                out.extend(str(tuple(r)) for r in conn.execute(f'SELECT * FROM "{name}"').fetchall())
            except sqlite3.Error:
                pass
        return "\n".join(out)


def test_identification_answers_the_profiles_and_the_suggestion(env, caplog):
    caplog.set_level(logging.DEBUG)
    job, got = scan_and_identify(env)
    hik, dahua = got["10.77.0.71"], got["10.77.0.72"]
    assert (hik["auth"], hik["auth_mode"], hik["media"], hik["snapshot"]) == ("ok", "wsse", "media2", True)
    assert hik["suggested"] == {"main": "MainH265", "sub": "Sub"}
    assert hik["profiles"][0] == {"token": "MainH265", "name": "main", "codec": "h265", "width": 3840, "height": 2160, "fps": 20, "stream": "ok",
                                  "uri_masked": "rtsp://10.77.0.71:554/Streaming/Channels/101?transportmode=unicast"}
    assert (dahua["auth"], dahua["auth_mode"], dahua["media"], dahua["suggested"]) == ("ok", "digest", "media", {"main": "Profile_1", "sub": "Profile_2"})
    assert got["10.77.0.76"]["suggested"] == {"main": None, "sub": None} and {p["stream"] for p in got["10.77.0.76"]["profiles"]} == {"other_host"}
    for a in ("10.77.0.74", "10.77.0.80"):  # Q58 / Q59: never contacted, nothing read
        assert (got[a]["auth"], got[a]["profiles"], got[a]["media"]) == ("skipped", [], "none")
        assert env.net.devices[a].actions == []
    assert [d.auth_requests for a, d in env.net.devices.items() if a in ("10.77.0.71", "10.77.0.72", "10.77.0.76")] == [1, 2, 1]
    poll = env.c.get(f"{API}/scans/{job['id']}").json()
    assert {d["address"]: d for d in poll["devices"]}["10.77.0.71"]["profiles"] == hik["profiles"]
    no_secret(json.dumps([job, got, poll]) + caplog.text + json.dumps(audit_rows(env.settings, "camera.discovery.identify"), default=str), "identify")
    assert USER not in json.dumps(got) + caplog.text


def test_the_lockout_guard_counts_the_digest_retry(env):
    job = env.c.post(f"{API}/scans", json={"range": RANGE}).json()
    cam = {d["address"]: d["id"] for d in job["devices"]}["10.77.0.72"]  # HTTP Digest only
    dev = env.net.devices["10.77.0.72"]

    def one(pw):
        return env.c.post(f"{API}/scans/{job['id']}/identify", json={"device_ids": [cam], "username": USER, "password": pw}).json()["devices"][0]["auth"]

    assert one("bad-1") == "wrong_password"  # WS-Security 401 + Digest refused: two guard entries
    assert one("bad-2") == "locked_guard"  # WS-Security 401 (third entry), the Digest answer is not sent
    assert one(PASSWORD) == "locked_guard"  # not contacted at all
    assert [m for _s, a, m in dev.calls if a == "GetDeviceInformation"] == ["wsse", "digest", "wsse"]
    assert dev.failures == 1  # the camera itself saw one failed login


def add(env, job, cameras, **kw):
    return env.c.post(f"{API}/scans/{job['id']}/add", json={"cameras": cameras}, **kw)


def test_add_creates_sealed_cameras_without_a_recorder(env, caplog):
    caplog.set_level(logging.DEBUG)
    job, got = scan_and_identify(env)
    before = list(env.net.http_requests)
    r = add(env, job, [{"device_id": got["10.77.0.71"]["id"], "name": "חניה", "area_id": "parking"},
                       {"device_id": got["10.77.0.72"]["id"], "main_profile": "Profile_1", "sub_profile": "Profile_2"}])
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["failed"] == [] and [a["device_id"] for a in body["added"]] == [got["10.77.0.71"]["id"], got["10.77.0.72"]["id"]]
    assert env.net.http_requests == before  # adding contacts no camera
    hik_id, dahua_id = (a["camera_id"] for a in body["added"])
    listed = env.c.get("/api/v1/cameras").json()
    cams = {c["id"]: c for c in (listed["cameras"] if isinstance(listed, dict) else listed)}
    assert cams[hik_id]["standalone"] is True
    with env.db.connection(mode="read") as conn:
        rows = {r["camera_id"]: dict(r) for r in conn.execute("SELECT * FROM camera_stream_sources").fetchall()}
        names = {r["id"]: r["alias"] for r in conn.execute("SELECT id, alias FROM cameras").fetchall()}
        fps = {r["id"]: r["device_fingerprint"] for r in conn.execute("SELECT id, device_fingerprint FROM cameras").fetchall()}
    hik = rows[hik_id]
    assert hik["origin"] == "onvif" and hik["area_id"] == "parking" and names[hik_id] == "חניה"
    assert names[dahua_id] == "Dahua IPC-HDW2431T - 72"  # design 4.5's default name
    enc_pw = "Cam%3APass%231%2Fx"
    assert hik["main_display"] == f"rtsp://{USER}:***@10.77.0.71:554/Streaming/Channels/101?transportmode=unicast"
    assert connection_store.open_camera_source(env.settings.data_dir, hik_id, "main", hik["main_url_enc"]) == (
        f"rtsp://{USER}:{enc_pw}@10.77.0.71:554/Streaming/Channels/101?transportmode=unicast")
    assert connection_store.open_camera_source(env.settings.data_dir, hik_id, "sub", hik["sub_url_enc"]).endswith("@10.77.0.71:554/Streaming/Channels/102?transportmode=unicast")
    origin = json.loads(hik["onvif_json"])
    assert origin["main_profile"] == "MainH265" and origin["sub_profile"] == "Sub" and origin["media"] == "media2" and origin["auth_mode"] == "wsse"
    assert origin["device_host"] == "10.77.0.71" and len(origin["endpoint_hmac"]) == 16 and "urn:uuid" not in hik["onvif_json"]
    assert json.loads(rows[dahua_id]["onvif_json"])["auth_mode"] == "digest"
    probe = json.loads(hik["probe_json"])
    assert probe["main"]["codec_label"] == "H.265" and probe["sub"]["codec_label"] == "H.264"  # the live player's H.265 hint
    assert fps[hik_id] == known.camera_fingerprint(b"salt-onvif-client-test", "standalone", "DS-2CD2143G2-I", SERIALS[0])
    src = env.c.get(f"/api/v1/cameras/{hik_id}/source").json()
    assert src["origin"] == "onvif" and src["main"]["url"].endswith("/Streaming/Channels/101?transportmode=unicast")
    # the job: marked as already in the system, the pair forgotten
    poll = {d["address"]: d for d in env.c.get(f"{API}/scans/{job['id']}").json()["devices"]}
    assert (poll["10.77.0.71"]["known"], poll["10.77.0.71"]["known_ref"], poll["10.77.0.71"]["addable"]) == ("standalone", hik_id, False)
    internal = env.m._jobs[job["id"]].devices[got["10.77.0.71"]["id"]]
    assert internal.creds is None and internal.profiles == []
    again = add(env, job, [{"device_id": got["10.77.0.71"]["id"]}]).json()
    assert again["added"] == [] and again["failed"][0]["code"] == "already_added"
    details = audit_details(env.settings, "camera.discovery.add")
    assert details[0] == {"requested": 2, "added": [hik_id, dahua_id], "origin": "onvif"}
    assert details[1]["failed"] == {"already_added": 1}
    created = audit_rows(env.settings, "camera.standalone.create")
    assert len(created) == 2 and all(json.loads(r["details_json"])["origin"] == "onvif" for r in created)
    # a new scan knows the added cameras by address
    job2 = env.c.post(f"{API}/scans", json={"range": RANGE}).json()
    assert {d["address"]: d["known"] for d in job2["devices"]}["10.77.0.72"] == "standalone"
    dump = db_dump(env)
    no_secret(json.dumps([body, poll, src, again]) + caplog.text + json.dumps(audit_rows(env.settings, "camera.discovery.add"), default=str) + dump,
              "after the add")
    assert "Cam:Pass" not in dump


def test_add_refuses_per_row_and_never_contacts_a_device(env):
    job, got = scan_and_identify(env)
    before = list(env.net.http_requests)
    rows = [{"device_id": got["10.77.0.74"]["id"]}, {"device_id": got["10.77.0.80"]["id"]}, {"device_id": got["10.77.0.76"]["id"]},
            {"device_id": "dnope"}, {"device_id": got["10.77.0.71"]["id"], "main_profile": "Nope"},
            {"device_id": got["10.77.0.72"]["id"], "sub_profile": "Nope"}, {"device_id": got["10.77.0.72"]["id"]}]
    r = add(env, job, rows)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["added"] == []
    assert [f["code"] for f in body["failed"]] == ["behind_recorder", "is_recorder", "no_stream", "device_unknown", "profile_unknown",
                                                   "profile_unknown", "device_duplicate"]
    assert all(isinstance(f["message"], str) and f["message"] for f in body["failed"])
    assert env.net.http_requests == before
    [row] = audit_rows(env.settings, "camera.discovery.add")
    assert row["decision"] == "denied" and row["reason"] == "nothing_added"
    with env.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM cameras WHERE recorder_id = 'standalone'").fetchone()[0] == 0


def test_an_unidentified_or_refused_camera_cannot_be_added(env):
    job = env.c.post(f"{API}/scans", json={"range": RANGE}).json()
    ids = {d["address"]: d["id"] for d in job["devices"]}
    env.c.post(f"{API}/scans/{job['id']}/identify", json={"device_ids": [ids["10.77.0.72"]], "username": USER, "password": WRONG})
    body = add(env, job, [{"device_id": ids["10.77.0.71"]}, {"device_id": ids["10.77.0.72"]}]).json()
    assert [f["code"] for f in body["failed"]] == ["not_identified", "not_identified"]


def test_add_partial_success_at_the_standalone_limit(env, monkeypatch):
    monkeypatch.setattr(cs, "STANDALONE_MAX", 1)
    job, got = scan_and_identify(env)
    body = add(env, job, [{"device_id": got["10.77.0.71"]["id"]}, {"device_id": got["10.77.0.72"]["id"]}]).json()
    assert len(body["added"]) == 1 and [f["code"] for f in body["failed"]] == ["standalone_limit"]
    assert audit_details(env.settings, "camera.discovery.add")[0]["failed"] == {"standalone_limit": 1}


def test_add_refusals_of_the_request(env):
    job, got = scan_and_identify(env, ("10.77.0.71",))
    cam = got["10.77.0.71"]["id"]
    for payload, fields in [({"cameras": []}, ["cameras"]), ({"cameras": [{"device_id": cam, "x": 1}]}, ["cameras.0.x"]),
                            ({"cameras": [{"device_id": 7}]}, ["cameras.0.device_id"]), ({}, ["cameras"]),
                            ({"cameras": [{"device_id": cam, "name": "n" * 121}]}, ["cameras.0.name"])]:
        r = env.c.post(f"{API}/scans/{job['id']}/add", json=payload)
        assert r.status_code == 422 and r.json()["code"] == "validation" and r.json()["details"]["fields"] == fields, (payload, r.text)
    r = env.c.post(f"{API}/scans/0123456789abcdef/add", json={"cameras": [{"device_id": cam}]})
    assert r.status_code == 404 and r.json()["code"] == "scan_not_found"
    env.c.delete(f"{API}/scans/{job['id']}")  # cancel: the credentials and the profiles are forgotten
    assert env.m._jobs[job["id"]].devices[cam].profiles == [] and env.m._jobs[job["id"]].devices[cam].creds is None
    r = add(env, job, [{"device_id": cam}])
    assert r.status_code == 409 and r.json()["code"] == "scan_not_active"


def test_add_needs_the_webrtc_server_before_the_body_is_read(env):
    job, got = scan_and_identify(env, ("10.77.0.71",))
    env.app.state.settings = replace(env.settings, go2rtc_url=None)
    r = env.c.post(f"{API}/scans/{job['id']}/add", content=b"not json", headers={"content-type": "text/plain"})
    assert r.status_code == 409 and r.json()["code"] == "webrtc_server_required" and set(r.json()) == ENVELOPE


def test_add_route_rbac(env):
    job, got = scan_and_identify(env, ("10.77.0.71",))
    env.c.get("/api/v1/me", headers=as_user("guard"))
    r = add(env, job, [{"device_id": got["10.77.0.71"]["id"]}], headers=as_user("guard"))
    assert r.status_code == 403 and r.json()["code"] == "forbidden"
    assert audit_rows(env.settings, "camera.discovery.add") == []


# ================================================================ the preview form of POST /cameras/source/test

def test_preview_of_a_found_camera_assembles_the_address_on_the_server(env, caplog):
    caplog.set_level(logging.DEBUG)
    job, got = scan_and_identify(env)
    r = env.c.post("/api/v1/cameras/source/test", json={"scan_id": job["id"], "device_id": got["10.77.0.71"]["id"], "profile": "main"})
    assert r.status_code == 200, r.text
    assert r.json()["ok"] is True and r.json()["width"] == 320 and r.json()["preview"].startswith("data:image/jpeg;base64,")
    frames = [p for m, path, p in env.go.requests if path == "/api/frame.jpeg"]
    assert frames[-1]["src"] == f"rtsp://{USER}:Cam%3APass%231%2Fx@10.77.0.71:554/Streaming/Channels/101?transportmode=unicast"
    assert frames[-1]["name"].startswith("smplwise_cam_probe_")
    assert not [n for n in env.go.store if n.startswith("smplwise_cam_probe_")]  # the throwaway stream is gone
    r2 = env.c.post("/api/v1/cameras/source/test", json={"scan_id": job["id"], "device_id": got["10.77.0.72"]["id"], "profile": "sub"})
    assert r2.json()["ok"] is True
    assert [p for m, path, p in env.go.requests if path == "/api/frame.jpeg"][-1]["src"].endswith("subtype=1")
    r3 = env.c.post("/api/v1/cameras/source/test", json={"scan_id": job["id"], "device_id": got["10.77.0.71"]["id"], "profile_token": "Tiny"})
    assert r3.json()["ok"] is True and [p for m, path, p in env.go.requests if path == "/api/frame.jpeg"][-1]["src"].endswith("/Channels/103?transportmode=unicast")
    rows = audit_rows(env.settings, "camera.source.test")
    assert [json.loads(r["details_json"]) for r in rows] == [{"profile": "main", "origin": "onvif", "outcome": "ok"},
                                                            {"profile": "sub", "origin": "onvif", "outcome": "ok"},
                                                            {"profile": "main", "origin": "onvif", "outcome": "ok"}]
    no_secret(r.text + r2.text + r3.text + caplog.text + json.dumps(rows, default=str), "in the preview")


def test_preview_refusals(env):
    job, got = scan_and_identify(env)

    def post(body):
        return env.c.post("/api/v1/cameras/source/test", json=body)

    r = post({"scan_id": job["id"], "device_id": got["10.77.0.71"]["id"], "url": "rtsp://10.77.0.71/x"})
    assert r.status_code == 422 and r.json()["details"]["fields"] == ["url"]
    r = post({"scan_id": job["id"]})
    assert r.status_code == 422 and r.json()["details"]["fields"] == ["device_id"]
    for dev, code in (("10.77.0.74", "behind_recorder"), ("10.77.0.80", "is_recorder"), ("10.77.0.76", "no_stream")):
        r = post({"scan_id": job["id"], "device_id": got[dev]["id"]})
        assert r.status_code == 422 and r.json()["code"] == code, r.text
    r = post({"scan_id": job["id"], "device_id": got["10.77.0.71"]["id"], "profile_token": "Nope"})
    assert r.status_code == 422 and r.json()["code"] == "profile_unknown" and r.json()["details"]["fields"] == ["profile_token"]
    r = post({"scan_id": "0123456789abcdef", "device_id": got["10.77.0.71"]["id"]})
    assert r.status_code == 404 and r.json()["code"] == "scan_not_found"
    assert not [path for m, path, p in env.go.requests if path == "/api/frame.jpeg"]  # nothing reached go2rtc
    assert cs._TESTS == {} or all(len(q) == 0 for q in cs._TESTS.values())  # refusals before the budget


def test_preview_shares_the_stream_test_budget(env):
    job, got = scan_and_identify(env, ("10.77.0.71",))
    body = {"scan_id": job["id"], "device_id": got["10.77.0.71"]["id"]}
    codes = [env.c.post("/api/v1/cameras/source/test", json=body).status_code for _ in range(cs.TEST_MAX_PER_MIN + 1)]
    assert codes == [200] * cs.TEST_MAX_PER_MIN + [429]


# ================================================================ migration 0217

def test_the_origin_columns(env):
    with env.db.connection() as conn:
        cols = {r[1] for r in conn.execute("PRAGMA table_info(camera_stream_sources)").fetchall()}
        assert {"origin", "onvif_json"} <= cols
        with pytest.raises(sqlite3.IntegrityError):
            conn.execute("INSERT INTO camera_stream_sources(camera_id, main_url_enc, origin, created_at, updated_at) VALUES ('c1', 'v1:x', 'other', 'a', 'a')")
    r = env.c.post("/api/v1/cameras/standalone", json={"name": "ידנית", "main_url": "rtsp://10.77.0.90:554/live"})
    assert r.status_code == 201, r.text
    cid = r.json()["id"]
    assert env.c.get(f"/api/v1/cameras/{cid}/source").json()["origin"] == "manual"
    with env.db.connection(mode="read") as conn:
        assert tuple(conn.execute("SELECT origin, onvif_json FROM camera_stream_sources WHERE camera_id = ?", (cid,)).fetchone()) == ("manual", None)
    assert cs.origin_of({"origin": None}) == "manual" and cs.origin_of(None) is None
