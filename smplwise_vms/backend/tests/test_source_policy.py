"""What a camera's stream source may be before go2rtc is pointed at it (Opus review M1): a source is device-controlled data, so it
must not reach go2rtc's own API or its RTSP restream, and a private LAN camera must still pass. The SAME corpus runs through the
add-on's policy (services/source_policy.py) and the bridge's (integration stream_source_service.py); they must agree."""
from __future__ import annotations

import ipaddress
import socket

import pytest

from bridge_loader import load
from smplwise.services import source_policy as sp

bridge = load("stream_source_service")

NOT_ALLOWED = "source_not_allowed"
NOT_SUPPORTED = "source_not_supported"

REFUSED_NOT_ALLOWED = [
    # the scenario of the review: go2rtc's own API through http, repointing a stream we do not own
    "http://127.0.0.1:1984/api/frame.jpeg?src=rtsp://evil&name=smplwise_wiskey_gate",
    "http://127.0.0.1:1984/api/streams",
    # loopback in every spelling
    "rtsp://127.0.0.1/x", "rtsp://127.1/x", "rtsp://127.0.1/x", "rtsp://0x7f.1/x", "rtsp://0x7f000001/x", "rtsp://2130706433/x",
    "rtsp://017700000001/x", "rtsp://0177.0.0.1/x", "rtsp://127.255.255.254/x", "rtsp://[::1]/x", "rtsp://[0:0:0:0:0:0:0:1]/x",
    "rtsp://[::ffff:127.0.0.1]/x", "rtsp://[::ffff:7f00:1]/x", "rtsp://[::127.0.0.1]/x",
    "rtsp://localhost/x", "rtsp://LOCALHOST/x", "rtsp://localhost./x", "rtsp://go2rtc.localhost/x",
    # unspecified, "this network", link-local (cloud metadata), multicast
    "rtsp://0.0.0.0/x", "rtsp://0/x", "rtsp://0.1.2.3/x", "rtsp://[::]/x", "rtsp://169.254.169.254/x", "rtsp://[fe80::1]/x",
    "rtsp://224.0.0.1/x", "rtsp://[ff02::1]/x", "rtsp://[::ffff:169.254.169.254]/x",
    # userinfo does not hide the real host
    "http://cam-user:pw@127.0.0.1/x", "http://192.0.2.10@127.0.0.1/x",
    # something that looks like an address but is not a valid one: refused, not guessed at
    "rtsp://1.2.3.4.5/x", "rtsp://999.1.1.1/x", "rtsp://0x/x", "rtsp://08.1.1.1/x",
    # a query that carries go2rtc's own parameters, whatever the case, encoding or separator, on any scheme and host
    "rtsp://192.0.2.10/s?src=rtsp://x", "rtsp://192.0.2.10/s?SRC=x", "rtsp://192.0.2.10/s?name=smplwise_x", "rtsp://192.0.2.10/s?Name=x",
    "rtsp://192.0.2.10/s?%73rc=x", "rtsp://192.0.2.10/s?a=1&src=x", "rtsp://192.0.2.10/s?a=1;src=x", "rtsp://192.0.2.10/s?src", "http://cam.lan/s?a=b&NAME=c",
    # go2rtc's API on port 1984 of any host, however the path is spelled
    "http://192.0.2.10:1984/api/streams", "https://cam.lan:1984/api", "http://192.0.2.10:1984//api/frame.jpeg", "http://192.0.2.10:1984/%2e/api/x",
    "http://192.0.2.10:1984/%2561pi/streams", "http://192.0.2.10:1984/API/streams", "http://192.0.2.10:1984/x/../api/streams",
]
REFUSED_NOT_SUPPORTED = [
    "exec:ffmpeg -i x -f mpegts -", "ffmpeg:rtsp://192.0.2.10/x", "file:///etc/passwd", "rtmp://192.0.2.10/x", "rtsp://192.0.2.10/x#video=copy",
    "rtsp://192.0.2.10/x y", "rtsp://192.0.2.10/x\n", "rtsp://192.0.2.10/" + "a" * 2100,
    "rtsp://exämple.com/x", "rtsp://１２７.0.0.1/x", "rtsp://192.0.2.10\\@127.0.0.1/x", "http://%31%32%37.0.0.1/x", "http://cam%2e%6cocal/x",
    "rtsp:///x", "rtsp://:554/x", "rtsp://192.0.2.10:99999/x", "rtsp://192.0.2.10:abc/x",
]
ACCEPTED = [
    "rtsp://user:pass@192.0.2.10:554/stream1",  # the review's normal case
    "rtsp://172.20.1.20/h264", "rtsp://172.31.0.5:8554/cam1", "rtsp://172.16.4.9:554/x", "rtsps://cam.example.com/s",
    "http://172.31.0.5:8080/video.mjpg", "https://cam.local/stream?x=1&token=abc", "http://192.0.2.10/api/status",  # /api on port 80 is a camera's own
    "http://192.0.2.10:1984/stream.mjpg",  # a camera on 1984 that is not go2rtc's API
    "rtsp://[2001:db8::10]/s", "rtsp://cam-user:p%40ss@192.0.2.60:554/x?token=abc", "rtsp://cam.lan:554/Streaming/Channels/101",
    "rtsp://192.0.2.10/s?source=x&names=y",  # only the exact keys src and name
]


@pytest.mark.parametrize("value", REFUSED_NOT_ALLOWED)
def test_addon_refuses_a_source_that_points_back_at_go2rtc_or_the_host(value):
    assert sp.source_refusal(value) == NOT_ALLOWED, value


@pytest.mark.parametrize("value", REFUSED_NOT_SUPPORTED)
def test_addon_refuses_what_is_not_a_plain_streaming_url(value):
    assert sp.source_refusal(value) == NOT_SUPPORTED, value


@pytest.mark.parametrize("value", ACCEPTED)
def test_addon_accepts_private_lan_cameras_and_normal_urls(value):
    assert sp.source_refusal(value) is None, value


@pytest.mark.parametrize("value", REFUSED_NOT_ALLOWED + REFUSED_NOT_SUPPORTED + ACCEPTED + [None, "", 5, b"rtsp://x"])
def test_the_bridge_and_the_addon_agree_on_every_shape(value):
    assert bridge.source_shape_error(value) == sp.source_refusal(value), value


def test_the_bridge_refuses_the_same_shapes_with_the_same_codes():
    for value in REFUSED_NOT_ALLOWED:
        assert bridge.source_shape_error(value) == NOT_ALLOWED, value
    for value in REFUSED_NOT_SUPPORTED:
        assert bridge.source_shape_error(value) == NOT_SUPPORTED, value
    for value in ACCEPTED:
        assert bridge.source_shape_error(value) is None, value


def test_the_refusal_never_contains_the_value():
    for value in ("rtsp://u:secret-pw@127.0.0.1/x?token=tok", "rtsp://u:secret-pw@192.0.2.10/x?src=tok"):
        code = sp.source_refusal(value)
        assert code == NOT_ALLOWED and "secret" not in code and "127" not in code


# ---------------------------------------------------------------- go2rtc's own host (the add-on knows where it runs)

@pytest.fixture(autouse=True)
def _no_dns_cache():
    sp._RESOLVED.clear()
    yield
    sp._RESOLVED.clear()


def test_go2rtcs_own_host_is_refused_on_go2rtcs_ports_only():
    t = sp.go2rtc_targets("http://192.0.2.99:1984")
    for value in ("rtsp://192.0.2.99:8554/smplwise_wiskey_gate", "rtsp://192.0.2.99:1984/x", "http://192.0.2.99:8555/x", "rtsp://[::ffff:192.0.2.99]:8554/x",
                  f"rtsp://{int(ipaddress.IPv4Address('192.0.2.99'))}:8554/x", "rtsp://0xc0.0x0.2.99:8554/x", "http://192.0.2.99:1984/stream.html"):
        assert sp.source_refusal(value, t) == NOT_ALLOWED, value
    for value in ("rtsp://192.0.2.99:554/cam", "rtsp://192.0.2.99/cam", "rtsp://192.0.2.98:8554/x", "http://192.0.2.99:8080/video"):
        assert sp.source_refusal(value, t) is None, value  # a camera on the same machine (another add-on) or another go2rtc


def test_go2rtcs_configured_port_counts_and_a_name_is_compared_with_what_it_resolves_to(monkeypatch):
    monkeypatch.setattr(socket, "getaddrinfo", lambda host, *a, **k: [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("192.0.2.77", 0))] if host == "go2rtc.lan" else (_ for _ in ()).throw(socket.gaierror()))
    t = sp.go2rtc_targets("http://go2rtc.lan:9999")
    for value in ("rtsp://go2rtc.lan:9999/x", "rtsp://GO2RTC.LAN.:8554/x", "rtsp://192.0.2.77:8554/x", "rtsp://192.0.2.77:9999/x", "rtsp://0xc0.0.2.77:8555/x"):
        assert sp.source_refusal(value, t) == NOT_ALLOWED, value
    assert sp.source_refusal("rtsp://192.0.2.77:554/x", t) is None
    assert sp.source_refusal("rtsp://other.lan:8554/x", t) is None


def test_go2rtc_targets_tolerates_nothing_configured_and_unresolvable_names():
    assert sp.go2rtc_targets(None) == [] and sp.go2rtc_targets("") == [] and sp.go2rtc_targets("http://:1984") == []
    t = sp.go2rtc_targets("http://no-such-host.invalid:1984")
    assert sp.source_refusal("rtsp://no-such-host.invalid:8554/x", t) == NOT_ALLOWED
    assert sp.source_refusal("rtsp://192.0.2.5:8554/x", t) is None


def test_the_ipv4_spellings_agree_with_the_c_library():
    for text in ("127.1", "0x7f.1", "2130706433", "017700000001", "172.16.0.1", "172.16.257", "0300.0250.0.1", "1"):
        want = ipaddress.IPv4Address(socket.inet_ntoa(socket.inet_aton(text)))
        assert sp.address_of(text) == want, text
    for text in ("1.2.3.4.5", "256.1.1.1", "08.1", "0x", "1..2", "", "a.b"):
        assert sp.address_of(text) is None, text
