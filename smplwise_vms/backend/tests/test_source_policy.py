"""What a camera's stream source may be before go2rtc is pointed at it (Opus review M1): a source is device-controlled data, so it
must not reach go2rtc's own API or its RTSP restream, and a private LAN camera must still pass. Only rtsp / rtsps sources are
accepted (M1-residual: an http(s) source is an indirect route back into go2rtc), and a host NAME is judged by what it resolves to.
The SAME corpus runs through the add-on's policy (services/source_policy.py) and the bridge's (integration
stream_source_service.py); they must agree. No test resolves a real name: the resolvers are replaced by a table."""
from __future__ import annotations

import asyncio
import ipaddress
import socket
import time

import pytest

from bridge_loader import load
from smplwise.services import source_policy as sp

bridge = load("stream_source_service")

NOT_ALLOWED = "source_not_allowed"
NOT_SUPPORTED = "source_not_supported"

REFUSED_NOT_ALLOWED = [
    # loopback in every spelling
    "rtsp://127.0.0.1/x", "rtsp://127.1/x", "rtsp://127.0.1/x", "rtsp://0x7f.1/x", "rtsp://0x7f000001/x", "rtsp://2130706433/x",
    "rtsp://017700000001/x", "rtsp://0177.0.0.1/x", "rtsp://127.255.255.254/x", "rtsp://[::1]/x", "rtsp://[0:0:0:0:0:0:0:1]/x",
    "rtsp://[::ffff:127.0.0.1]/x", "rtsp://[::ffff:7f00:1]/x", "rtsp://[::127.0.0.1]/x",
    "rtsp://localhost/x", "rtsp://LOCALHOST/x", "rtsp://localhost./x", "rtsp://go2rtc.localhost/x",
    # unspecified, "this network", link-local (cloud metadata), multicast
    "rtsp://0.0.0.0/x", "rtsp://0/x", "rtsp://0.1.2.3/x", "rtsp://[::]/x", "rtsp://169.254.169.254/x", "rtsp://[fe80::1]/x",
    "rtsp://224.0.0.1/x", "rtsp://[ff02::1]/x", "rtsp://[::ffff:169.254.169.254]/x",
    # userinfo does not hide the real host
    "rtsp://cam-user:pw@127.0.0.1/x", "rtsp://192.0.2.10@127.0.0.1/x",
    # something that looks like an address but is not a valid one: refused, not guessed at
    "rtsp://1.2.3.4.5/x", "rtsp://999.1.1.1/x", "rtsp://0x/x", "rtsp://08.1.1.1/x",
    # a query that carries go2rtc's own parameters, whatever the case, encoding or separator, on any scheme and host
    "rtsp://192.0.2.10/s?src=rtsp://x", "rtsp://192.0.2.10/s?SRC=x", "rtsp://192.0.2.10/s?name=smplwise_x", "rtsp://192.0.2.10/s?Name=x",
    "rtsp://192.0.2.10/s?%73rc=x", "rtsp://192.0.2.10/s?a=1&src=x", "rtsp://192.0.2.10/s?a=1;src=x", "rtsp://192.0.2.10/s?src", "rtsp://cam.lan/s?a=b&NAME=c",
]
REFUSED_NOT_SUPPORTED = [
    # M1-residual: http(s) is not a camera source - go2rtc would GET it, and that reaches go2rtc's own API or any internal service
    "http://127.0.0.1:1984/api/frame.jpeg?src=rtsp://evil&name=smplwise_wiskey_gate", "http://127.0.0.1:1984/api/streams", "http://192.0.2.10:1984/api/streams",
    "https://cam.lan:1984/api", "http://192.0.2.10:1984/%2561pi/streams", "http://cam-user:pw@127.0.0.1/x", "http://192.0.2.10/api/status",
    "http://172.31.0.5:8080/video.mjpg", "https://cam.local/stream?x=1&token=abc", "HTTP://192.0.2.10/x", "Https://cam.example.com/s",
    "exec:ffmpeg -i x -f mpegts -", "ffmpeg:rtsp://192.0.2.10/x", "file:///etc/passwd", "rtmp://192.0.2.10/x", "rtsp://192.0.2.10/x#video=copy",
    "rtsp://192.0.2.10/x y", "rtsp://192.0.2.10/x\n", "rtsp://192.0.2.10/" + "a" * 2100,
    "rtsp://exämple.com/x", "rtsp://１２７.0.0.1/x", "rtsp://192.0.2.10\\@127.0.0.1/x", "rtsp://%31%32%37.0.0.1/x", "rtsp://cam%2e%6cocal/x",
    "rtsp:///x", "rtsp://:554/x", "rtsp://192.0.2.10:99999/x", "rtsp://192.0.2.10:abc/x",
]
ACCEPTED = [
    "rtsp://user:pass@192.0.2.10:554/stream1",  # the review's normal case
    "rtsp://172.20.1.20/h264", "rtsp://172.31.0.5:8554/cam1", "rtsp://172.16.4.9:554/x", "rtsps://cam.example.com/s",
    "rtsp://192.0.2.10:1984/stream",  # a camera on 1984 that is not go2rtc (go2rtc's own host is the add-on's extra check)
    "rtsp://[2001:db8::10]/s", "rtsp://cam-user:p%40ss@192.0.2.60:554/x?token=abc", "rtsp://cam.lan:554/Streaming/Channels/101", "RTSP://192.0.2.10/s",
    "rtsp://192.0.2.10/s?source=x&names=y",  # only the exact keys src and name
]


# what the made-up names resolve to; anything else does not resolve (an empty answer)
DNS = {
    "cam.lan": ["192.0.2.10"], "cam.example.com": ["192.0.2.11"],
    "127.0.0.1.nip.io": ["127.0.0.1"], "localtest.example": ["::1"], "metadata.example": ["169.254.169.254"], "mixed.example": ["192.0.2.10", "127.0.0.1"],
    "mapped.example": ["::ffff:127.0.0.1"], "zero.example": ["0.0.0.0"], "weird.example": ["not-an-address", "192.0.2.12"], "alias.lan": ["192.0.2.99"],
}
_REAL_RESOLVE = sp.resolve_host
_REAL_BRIDGE_RESOLVE = bridge._resolve


@pytest.fixture(autouse=True)
def _fake_resolvers(monkeypatch):
    """The add-on's and the bridge's resolvers are tables, never the network."""
    monkeypatch.setattr(sp, "resolve_host", lambda host, timeout=2.0: list(DNS.get(host, [])))

    async def resolve(host):
        return list(DNS.get(host, []))

    monkeypatch.setattr(bridge, "_resolve", resolve)


def bridge_error(value):
    return asyncio.run(bridge.async_resolved_error(value))


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
    assert bridge_error(value) == sp.source_refusal(value), value  # with the names resolved, too


@pytest.mark.parametrize("value", [f"rtsp://{h}/x" for h in (*DNS, "unresolved.example")] + ["rtsps://mapped.example:322/x"])
def test_the_bridge_and_the_addon_agree_on_every_name(value):
    assert bridge_error(value) == sp.source_refusal(value), value


def test_the_bridge_refuses_the_same_shapes_with_the_same_codes():
    for value in REFUSED_NOT_ALLOWED:
        assert bridge.source_shape_error(value) == NOT_ALLOWED, value
    for value in REFUSED_NOT_SUPPORTED:
        assert bridge.source_shape_error(value) == NOT_SUPPORTED, value
    for value in ACCEPTED:
        assert bridge.source_shape_error(value) is None, value
        assert bridge_error(value) is None, value


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
    for value in ("rtsp://192.0.2.99:8554/smplwise_wiskey_gate", "rtsp://192.0.2.99:1984/x", "rtsp://192.0.2.99:8555/x", "rtsp://[::ffff:192.0.2.99]:8554/x",
                  f"rtsp://{int(ipaddress.IPv4Address('192.0.2.99'))}:8554/x", "rtsp://0xc0.0x0.2.99:8554/x", "rtsps://192.0.2.99:1984/stream"):
        assert sp.source_refusal(value, t) == NOT_ALLOWED, value
    for value in ("rtsp://192.0.2.99:554/cam", "rtsp://192.0.2.99/cam", "rtsp://192.0.2.98:8554/x", "rtsp://192.0.2.99:8080/video"):
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


# ---------------------------------------------------------------- M1-residual: only rtsp(s); names are judged by what they resolve to

@pytest.mark.parametrize("value", ["http://192.0.2.10/x", "https://192.0.2.10/x", "http://cam.lan/x", "ws://192.0.2.10/x", "ftp://192.0.2.10/x", "rtmp://192.0.2.10/x", "udp://192.0.2.10:5000"])
def test_only_rtsp_and_rtsps_are_accepted(value):
    assert sp.source_refusal(value) == NOT_SUPPORTED and bridge.source_shape_error(value) == NOT_SUPPORTED and bridge_error(value) == NOT_SUPPORTED


@pytest.mark.parametrize("name", ["127.0.0.1.nip.io", "localtest.example", "metadata.example", "mixed.example", "mapped.example", "zero.example"])
def test_a_name_that_resolves_to_a_loopback_or_link_local_address_is_refused(name):
    assert sp.source_refusal(f"rtsp://{name}/x") == NOT_ALLOWED and sp.source_refusal(f"rtsps://{name.upper()}.:322/x") == NOT_ALLOWED
    assert bridge_error(f"rtsp://{name}/x") == NOT_ALLOWED and bridge_error(f"rtsps://{name.upper()}.:322/x") == NOT_ALLOWED
    assert bridge.source_shape_error(f"rtsp://{name}/x") is None  # the shape check alone does not resolve: the async one does


def test_a_name_with_a_private_lan_answer_or_no_answer_is_allowed_and_a_bad_answer_entry_is_skipped():
    for value in ("rtsp://cam.lan/x", "rtsp://unresolved.example/x", "rtsp://weird.example/x"):
        assert sp.source_refusal(value) is None and bridge_error(value) is None, value


def test_a_name_that_resolves_to_go2rtcs_own_host_is_refused_on_go2rtcs_ports_only():
    t = sp.go2rtc_targets("http://192.0.2.99:1984")
    assert sp.source_refusal("rtsp://alias.lan:8554/smplwise_wiskey_gate", t) == NOT_ALLOWED
    assert sp.source_refusal("rtsp://alias.lan:1984/x", t) == NOT_ALLOWED
    assert sp.source_refusal("rtsp://alias.lan:554/cam", t) is None
    assert sp.source_refusal("rtsp://alias.lan:8554/x") is None  # the bridge (no go2rtc host known) cannot tell; the add-on can


def test_go2rtcs_rtsp_port_is_refused_whatever_the_path():
    t = sp.go2rtc_targets("http://192.0.2.99:1984")
    for path in ("", "/", "/door-1", "/smplwise_nvr-1_ch1_sub", "//door-1", "/a/b/c", "/%64oor-1", "/x?y=1"):
        assert sp.source_refusal(f"rtsp://192.0.2.99:8554{path}", t) == NOT_ALLOWED, path
        assert sp.source_refusal(f"rtsps://192.0.2.99:8554{path}", t) == NOT_ALLOWED, path


def test_the_real_resolver_answers_nothing_for_a_failure_and_gives_up_on_a_slow_answer(monkeypatch):
    def fail(*a, **k):
        raise socket.gaierror("no such host")

    monkeypatch.setattr(socket, "getaddrinfo", fail)
    assert _REAL_RESOLVE("x.example") == []

    def slow(*a, **k):
        time.sleep(0.5)
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("127.0.0.1", 0))]

    monkeypatch.setattr(socket, "getaddrinfo", slow)
    started = time.monotonic()
    assert _REAL_RESOLVE("slow.example", timeout=0.05) == []
    assert time.monotonic() - started < 0.4

    monkeypatch.setattr(socket, "getaddrinfo", lambda *a, **k: [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("192.0.2.5", 0)), (socket.AF_INET6, socket.SOCK_STREAM, 6, "", ("::1", 0, 0, 0))])
    assert _REAL_RESOLVE("ok.example") == ["192.0.2.5", "::1"]


def test_the_bridges_resolver_gives_up_on_a_slow_answer_and_never_raises(monkeypatch):
    def slow(*a, **k):
        time.sleep(0.4)
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("127.0.0.1", 0))]

    monkeypatch.setattr(bridge, "_resolve", _REAL_BRIDGE_RESOLVE)
    monkeypatch.setattr(bridge, "RESOLVE_TIMEOUT_S", 0.05)
    monkeypatch.setattr(socket, "getaddrinfo", slow)
    assert asyncio.run(bridge._resolve("slow.example")) == []
    monkeypatch.setattr(socket, "getaddrinfo", lambda *a, **k: (_ for _ in ()).throw(socket.gaierror("x")))
    assert asyncio.run(bridge._resolve("gone.example")) == []
    monkeypatch.setattr(socket, "getaddrinfo", lambda *a, **k: [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("127.0.0.1", 0))])
    assert asyncio.run(bridge._resolve("loop.example")) == ["127.0.0.1"]
