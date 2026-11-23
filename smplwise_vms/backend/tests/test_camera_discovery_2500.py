"""ONVIF-DISCOVER-2500: camera discovery phase 1, the backend (design docs/design/onvif-discovery-2412/DESIGN.md; owner decisions
2026-11-22 Q55-Q61).

No real network anywhere: the UDP side is tests/fixtures/fake_onvif.FakeNetwork (an in-memory transport), the HTTP side its
httpx.MockTransport, the site network a fixed list (no Supervisor), recorder names resolve through a stub. One test uses a real UDP
socket pair on the loopback interface only. Addresses are TEST-NET-1 (10.77.0.0/24); users, passwords and serials are made up, and
every test that could leak one greps the answers, the audit rows and the log for it."""
from __future__ import annotations

import contextlib
import ipaddress
import json
import logging
import socket
import sys
import threading
import time
from pathlib import Path
from types import SimpleNamespace

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))

from conftest import make_client  # noqa: E402
from fake_onvif import FakeNetwork, FakeOnvifDevice, hik_scopes, probe_match  # noqa: E402
from support.audit import audit_details, audit_rows  # noqa: E402

from smplwise.db import Database, new_id, now_iso, set_setting  # noqa: E402
from smplwise.errors import ApiError  # noqa: E402
from smplwise.rbac import Principal  # noqa: E402
from smplwise.services import autosync, nvr, self_update  # noqa: E402
from smplwise.services.camera_discovery import known, onvif_http, ranges, service as svc, sweep, wsd  # noqa: E402

RANGE = "10.77.0.64/27"  # .65 - .94
HOST = "10.77.0.10/24"
PASSWORD, OTHER_PASSWORD, USER = "Cam-Pass-1", "Wrong-Pass-9", "admin"
SERIALS = ("FAKESERIAL0001", "FAKESERIAL0002", "FAKESERIAL0003", "NVRSERIAL0009")
ADMIN = Principal("dev-joni", "joni", "joni", "dev")
EVE = Principal("dev-eve", "eve", "eve", "dev")


def devices() -> list[FakeOnvifDevice]:
    return [
        FakeOnvifDevice("10.77.0.71", "urn:uuid:aaaaaaaa-0000-4000-8000-000000000071", scopes=hik_scopes("DS-2CD2143G2-I"), serial=SERIALS[0]),
        FakeOnvifDevice("10.77.0.72", "urn:uuid:aaaaaaaa-0000-4000-8000-000000000072", scopes=hik_scopes("IPC-HDW2431T", "Dahua IPC-HDW2431T"),
                        manufacturer="Dahua", model="IPC-HDW2431T", serial=SERIALS[1]),
        FakeOnvifDevice("10.77.0.73", "urn:uuid:aaaaaaaa-0000-4000-8000-000000000073", scopes=hik_scopes("DS-2CD2387G2"), serial=SERIALS[2],
                        clock_offset_s=600.0),  # the camera's clock is 10 minutes ahead
        FakeOnvifDevice("10.77.0.74", "urn:uuid:aaaaaaaa-0000-4000-8000-000000000074", scopes=hik_scopes("DS-2CD1023G0")),  # behind the recorder
        FakeOnvifDevice("10.77.0.75", "urn:uuid:aaaaaaaa-0000-4000-8000-000000000075", scopes=hik_scopes("DS-2CD1043G0")),  # already standalone
        FakeOnvifDevice("10.77.0.80", "urn:uuid:aaaaaaaa-0000-4000-8000-000000000080", scopes=hik_scopes("DS-7608NI-K2"), model="DS-7608NI-K2",
                        serial=SERIALS[3]),  # a recorder calling itself a video transmitter
        FakeOnvifDevice("10.77.0.81", "urn:uuid:aaaaaaaa-0000-4000-8000-000000000081", types="tds:Device",
                        scopes="onvif://www.onvif.org/type/NetworkVideoStorage onvif://www.onvif.org/hardware/VS-100"),  # answers round 2 only
        FakeOnvifDevice("10.77.0.90", "urn:uuid:aaaaaaaa-0000-4000-8000-000000000090", answers_probe=False),  # silent to UDP, ONVIF over HTTP
    ]


@pytest.fixture()
def env(settings, monkeypatch):
    client = make_client(settings)
    assert client.get("/api/v1/me").status_code == 200  # joni: the bootstrap system administrator
    net = FakeNetwork(devices())
    m = svc.MANAGER
    m.transport_factory = net
    m.run_inline = True
    m.listen_s = 0.05
    m.resolve = lambda name: []
    monkeypatch.setattr(onvif_http, "TRANSPORT", net.transport())
    monkeypatch.setattr(ranges, "SITE_INTERFACES", lambda s: [ipaddress.ip_interface(HOST)])
    db = Database(settings.db_path)
    with db.connection() as conn:
        set_setting(conn, svc.K_RATE, "200")
    return SimpleNamespace(client=client, net=net, db=db, settings=settings, m=m)


def scan(env, rng: str = RANGE, who: Principal = ADMIN) -> dict:
    with env.db.connection() as conn:
        return env.m.start_scan(conn, env.settings, who, rng, request_id="r-scan")


def identify(env, job: dict, ids: list[str], password: str = PASSWORD, same: bool = True, user: str = USER) -> dict:
    with env.db.connection() as conn:
        return env.m.identify(conn, env.settings, ADMIN, job["id"], device_ids=ids, username=user, password=password, same_for_all=same,
                              request_id="r-id")


def by_addr(job: dict) -> dict[str, dict]:
    return {d["address"]: d for d in job["devices"]}


def seed_standalone(env, host: str) -> str:
    cid = new_id()
    with env.db.connection() as conn:
        conn.execute("INSERT INTO recorders(id, name, created_at) VALUES ('standalone', 'x', ?) ON CONFLICT(id) DO NOTHING", (now_iso(),))
        conn.execute("INSERT INTO cameras(id, recorder_id, channel, name_source, sort_order, status, created_at, updated_at) "
                     "VALUES (?, 'standalone', 1, '', 1, 'unknown', ?, ?)", (cid, now_iso(), now_iso()))
        conn.execute("INSERT INTO camera_stream_sources(camera_id, main_url_enc, main_display, main_has_password, revision, created_at, updated_at, updated_by) "
                     "VALUES (?, 'v1:x', ?, 1, 1, ?, ?, 'test')", (cid, f"rtsp://admin:***@{host}:554/Streaming/Channels/101", now_iso(), now_iso()))
    return cid


# ================================================================ WS-Discovery: the probe and the reader

def test_the_probe_is_a_fixed_template():
    mid = wsd.new_message_id()
    data = wsd.probe(mid, wsd.TYPES_TRANSMITTER).decode()
    assert mid in data and "<d:Types>dn:NetworkVideoTransmitter</d:Types>" in data and "discovery/Probe" in data
    for bad_mid, types in (("uuid:x", wsd.TYPES_DEVICE), (mid, "dn:NetworkVideoTransmitter tds:Device<x/>"), (mid + "<", wsd.TYPES_DEVICE)):
        with pytest.raises(ValueError):
            wsd.probe(bad_mid, types)


def test_a_probe_match_is_read_with_its_scopes():
    dev = devices()[0]
    [m] = wsd.parse_probe_matches(probe_match(dev, "uuid:12345678-1234-4234-8234-123456789012"))
    assert m.relates_to == "uuid:12345678-1234-4234-8234-123456789012"
    assert m.endpoint == dev.endpoint and m.types == ("NetworkVideoTransmitter", "Device")
    assert (m.manufacturer, m.model, m.name) == ("HIKVISION", "DS-2CD2143G2-I", "HIKVISION DS-2CD2143G2-I")
    assert "video_encoder" in m.scope_types and dev.endpoint not in repr(m)


def test_several_matches_missing_xaddrs_and_foreign_xaddrs():
    one = probe_match(FakeOnvifDevice("10.77.0.71", "urn:uuid:1", xaddrs=""), None).decode()
    two = probe_match(FakeOnvifDevice("10.77.0.71", "urn:uuid:2"), None).decode()
    both = one.replace("</d:ProbeMatches>", two[two.index("<d:ProbeMatch>"):two.index("</d:ProbeMatches>")] + "</d:ProbeMatches>")
    ms = wsd.parse_probe_matches(both.encode())
    assert [m.endpoint for m in ms] == ["urn:uuid:1", "urn:uuid:2"] and ms[0].xaddrs == ()
    kept, dropped = wsd.same_host_xaddrs(["http://10.77.0.71/onvif/device_service", "http://10.77.0.99/onvif/device_service",
                                          "http://[fe80::1]/onvif/device_service", "http://cam.lan/onvif/device_service",
                                          "http://user:pw@10.77.0.71/onvif/device_service", "http://10.77.0.71:8080/onvif/x?y=1",
                                          "ftp://10.77.0.71/", "https://10.77.0.71:8443/onvif/device_service", "http://012.77.0.71/onvif"], "10.77.0.71")
    assert kept == [("http", 80, "/onvif/device_service"), ("https", 8443, "/onvif/device_service")]
    assert dropped == 7


@pytest.mark.parametrize("data", [
    b"",
    b"x" * (wsd.MAX_DATAGRAM + 1),
    b'<?xml version="1.0"?><!DOCTYPE a [<!ENTITY b "c">]><a>&b;</a>',
    '<?xml version="1.0" encoding="UTF-16"?><a/>'.encode("utf-16"),
    b"<s:Envelope xmlns:s='x'>" + b"<a>" * 40 + b"</a>" * 40 + b"</s:Envelope>",
    b"<s:Envelope xmlns:s='x'><s:Body><Probe/></s:Body></s:Envelope>",
    b"not xml at all",
], ids=["empty", "oversize", "doctype", "utf16", "deep", "not-probematches", "not-xml"])
def test_hostile_or_foreign_datagrams_are_refused(data):
    with pytest.raises(wsd.NotAProbeMatch):
        wsd.parse_probe_matches(data)


def test_recorders_are_recognised():
    assert wsd.classify(["NetworkVideoTransmitter", "Device"], ["video_encoder"], "DS-2CD2143G2-I") == "camera"
    assert wsd.classify(["NetworkVideoTransmitter", "Device"], ["video_encoder"], "DS-7608NI-K2") == "nvr"
    assert wsd.classify(["NetworkVideoTransmitter"], [], "DHI-NVR4104HS-P-4KS2") == "nvr"
    assert wsd.classify(["NetworkVideoTransmitter"], [], "NVR301-08S") == "nvr"
    assert wsd.classify(["Device"], ["networkvideostorage"], None) == "nvr"
    assert wsd.classify(["NetworkVideoStorage"], [], None) == "nvr"
    assert wsd.classify(["Device"], [], "iDS-7208HUHI") == "nvr"
    assert wsd.classify(["Device"], [], "IPC-HDW2431T") == "unknown"
    assert wsd.clean_value("HIKVISION%20DS-2CD<script>") == "HIKVISION DS-2CD script"


# ================================================================ the range (Q56)

def test_the_site_networks_come_from_the_host_interfaces():
    data = {"interfaces": [
        {"interface": "eth0", "enabled": True, "connected": True, "ipv4": {"address": ["10.77.0.10/24"]}},
        {"interface": "wlan0", "enabled": False, "connected": False, "ipv4": {"address": ["10.1.2.3/24"]}},
        {"interface": "hassio", "enabled": True, "connected": True, "ipv4": {"address": ["172.30.32.1/23"]}},
        {"interface": "tailscale0", "enabled": True, "connected": True, "ipv4": {"address": ["100.100.1.2/32"]}},
        {"interface": "eth1", "enabled": True, "connected": True, "ipv4": {"address": ["203.0.113.5/24", "169.254.1.1/16", "garbage", "192.0.2.4/24"]}},
        "junk"]}
    assert [str(i) for i in ranges.parse_network_info(data)] == ["10.77.0.10/24"]
    assert ranges.parse_network_info(None) == [] and ranges.parse_network_info({"interfaces": "x"}) == []
    assert ranges.suggested_range(ranges.parse_network_info(data)) == "10.77.0.0/24"
    assert ranges.suggested_range([ipaddress.ip_interface("10.4.0.9/16")]) == "10.4.0.0/24"


def test_the_supervisor_read_is_allow_listed_and_read_only():
    assert ("GET", self_update.P_NETWORK_INFO) in self_update.ALLOWED
    assert not any(p == self_update.P_NETWORK_INFO for m, p in self_update.ALLOWED if m != "GET")


def test_only_the_site_network_up_to_1024_addresses():
    site = [ipaddress.ip_interface("10.77.0.10/24"), ipaddress.ip_interface("10.20.0.5/16")]
    p = ranges.plan("10.77.0.0/24", site)
    assert len(p.targets) == 253 and "10.77.0.10" not in p.targets and "10.77.0.0" not in p.targets and "10.77.0.255" not in p.targets
    assert len(ranges.plan("10.20.4.0/22", site).targets) == 1022
    assert ranges.plan("10.77.0.77", site).targets == ("10.77.0.77",)
    cases = {"10.20.0.0/21": "range_too_large", "10.0.0.0/8": "range_too_large", "10.30.0.0/24": "range_refused",
             "198.51.100.0/24": "range_refused", "192.168.1.0/24": "range_refused", "2001:db8::/120": "range_invalid", "x": "range_invalid",
             "": "range_invalid", "10.77.0.10/32": "range_refused"}
    for text, code in cases.items():
        with pytest.raises(ranges.RangeRefused) as e:
            ranges.plan(text, site)
        assert e.value.code == code, text
    with pytest.raises(ranges.RangeRefused) as e:
        ranges.plan("10.77.0.0/24", [])
    assert e.value.code == "site_network_unknown"
    allowed = ranges.parse_allowed("10.77.0.64/26, junk 2001:db8::/64")
    assert [str(a) for a in allowed] == ["10.77.0.64/26"]
    assert ranges.plan("10.77.0.64/27", site, allowed=allowed).targets[0] == "10.77.0.65"
    with pytest.raises(ranges.RangeRefused):
        ranges.plan("10.77.0.0/24", site, allowed=allowed)  # the allow-list narrows, never widens
    with pytest.raises(ranges.RangeRefused):
        ranges.plan("10.77.0.0/24", site, max_addresses=128)
    with pytest.raises(ranges.RangeRefused):
        ranges.plan("10.20.0.0/21", site, max_addresses=10_000)  # the setting can never lift the owner's 1,024


# ================================================================ ONVIF device-service reads

def test_only_get_actions_can_be_built():
    # ONVIF-CLIENT-2500 widened the list to the fuller client's reads: still Get* only, per service
    assert onvif_http.SERVICE_ACTIONS == {
        "device": {"GetSystemDateAndTime", "GetDeviceInformation", "GetServices", "GetCapabilities"},
        "media": {"GetProfiles", "GetStreamUri", "GetSnapshotUri"}, "media2": {"GetProfiles", "GetStreamUri", "GetSnapshotUri"}}
    assert all(a.startswith("Get") for a in onvif_http.ALLOWED_ACTIONS)
    for action in ("SetSystemDateAndTime", "SystemReboot", "CreateUsers", "DeleteUsers", "SetUser", "SetNetworkInterfaces", "GetDeviceInformation/><x"):
        with pytest.raises(ValueError):
            onvif_http.envelope(action)
    src = "".join(p.read_text(encoding="utf-8") for p in (Path(svc.__file__).parent).glob("*.py"))
    import re
    built = set(re.findall(r"envelope\(\s*\"(\w+)\"", src))
    assert built and built <= onvif_http.ALLOWED_ACTIONS


def test_password_digest_follows_the_onvif_core_formula():
    import base64
    import hashlib
    nonce, created = bytes(range(16)), "2026-11-23T10:00:00.000Z"
    want = base64.b64encode(hashlib.sha1(nonce + created.encode() + b"secret").digest()).decode()
    assert onvif_http.password_digest("secret", nonce, created) == want


def test_device_information_one_request_and_its_outcomes(monkeypatch):
    devs = devices()
    devs[1].digest_only = True
    net = FakeNetwork(devs)
    monkeypatch.setattr(onvif_http, "TRANSPORT", net.transport())
    t = onvif_http.Target("10.77.0.73", 80)
    clk = onvif_http.device_clock(t)
    assert clk.onvif and 595 <= clk.offset_s <= 605
    assert onvif_http.device_information(t, USER, PASSWORD, None).auth == "wrong_password"  # the local clock: Created is 10 min off
    info = onvif_http.device_information(t, USER, PASSWORD, clk.offset_s)
    assert (info.auth, info.manufacturer, info.model, info.serial) == ("ok", "HIKVISION", "DS-2CD2143G2-I", SERIALS[2])
    assert SERIALS[2] not in repr(info)
    assert onvif_http.device_information(t, USER, OTHER_PASSWORD, clk.offset_s).failed_auth
    assert onvif_http.device_information(onvif_http.Target("10.77.0.72", 80), USER, PASSWORD, 0).auth == "digest_required"
    assert onvif_http.device_information(onvif_http.Target("10.77.0.99", 80), USER, PASSWORD, 0).auth == "no_answer"
    assert onvif_http.device_clock(onvif_http.Target("10.77.0.99", 80)) is None
    assert [a for h, a in net.http_requests if a not in ("GetSystemDateAndTime", "GetDeviceInformation")] == []


def test_hostile_http_answers(monkeypatch):
    import httpx

    def handler(request):
        host = request.url.host
        if host == "10.77.0.71":
            return httpx.Response(200, content=b"<a>" + b"x" * (onvif_http.MAX_BYTES + 10) + b"</a>")
        if host == "10.77.0.72":
            return httpx.Response(200, content=b'<?xml version="1.0"?><!DOCTYPE a [<!ENTITY b "c">]><a>&b;</a>')
        if host == "10.77.0.73":
            return httpx.Response(302, headers={"Location": "http://127.0.0.1:8123/api/"})
        return httpx.Response(200, content=b"<html>router login</html>")

    monkeypatch.setattr(onvif_http, "TRANSPORT", httpx.MockTransport(handler))
    assert onvif_http.device_information(onvif_http.Target("10.77.0.71", 80), USER, PASSWORD, 0).auth == "no_answer"
    assert onvif_http.device_information(onvif_http.Target("10.77.0.72", 80), USER, PASSWORD, 0).auth == "not_onvif"
    assert onvif_http.device_information(onvif_http.Target("10.77.0.73", 80), USER, PASSWORD, 0).auth == "not_onvif"  # never followed
    assert onvif_http.device_clock(onvif_http.Target("10.77.0.74", 80)).onvif is False


# ================================================================ the sweep

def _sweep(net, targets, **cfg):
    found = []
    stats = sweep.sweep(targets, config=sweep.Config(**{"rate_pps": 200, "listen_s": 0.05, **cfg}), on_found=found.append,
                        cancelled=threading.Event(), transport_factory=net)
    return found, stats


def test_two_rounds_paced_and_round_two_only_for_the_silent():
    net = FakeNetwork(devices())
    targets = [f"10.77.0.{i}" for i in range(65, 95)]
    found, stats = _sweep(net, targets, rate_pps=100)
    addrs = {f.address for f in found}
    assert addrs == {"10.77.0.71", "10.77.0.72", "10.77.0.73", "10.77.0.74", "10.77.0.75", "10.77.0.80", "10.77.0.81"}
    first = [a for _, a, p in net.sent if b"NetworkVideoTransmitter</d:Types>" in p]
    second = [a for _, a, p in net.sent if b">tds:Device</d:Types>" in p]
    assert first == targets and len(second) == len(targets) - 6 and "10.77.0.71" not in second and "10.77.0.81" in second
    times = [t for t, _, _ in net.sent[: len(targets)]]
    assert times[-1] - times[0] >= (len(targets) - 1) / 100 * 0.9  # paced: 100 datagrams a second at most
    assert stats.sent == len(net.sent) and net.closed == 1
    f81 = next(f for f in found if f.address == "10.77.0.81")
    assert f81.target is not None and f81.target.url() == "http://10.77.0.81:80/onvif/device_service"


def test_spoofed_and_stray_answers_are_dropped():
    devs = devices()
    devs[0].relates = "other"  # answers for a probe it was never sent
    devs[1].relates = "missing"  # no RelatesTo at all: accepted (it is the probed address)
    devs[2].xaddrs = "http://10.77.0.200/onvif/device_service"  # points elsewhere: listed without a service
    net = FakeNetwork(devs)
    net.inject(probe_match(FakeOnvifDevice("10.77.0.66", "urn:uuid:spoof"), None), "198.51.100.7")  # from outside the range
    net.inject(b"<garbage/>", "10.77.0.66")
    found, stats = _sweep(net, [f"10.77.0.{i}" for i in range(65, 80)])
    addrs = {f.address for f in found}
    assert "10.77.0.71" not in addrs and "10.77.0.72" in addrs and "198.51.100.7" not in addrs
    f73 = next(f for f in found if f.address == "10.77.0.73")
    assert f73.target is None and f73.xaddrs_dropped == 1
    assert stats.rejected >= 4  # 71 twice (two rounds), the outsider, the garbage


def test_cancel_and_deadline_stop_the_sweep():
    net = FakeNetwork(devices())
    ev = threading.Event()
    ev.set()
    stats = sweep.sweep([f"10.77.0.{i}" for i in range(1, 200)], config=sweep.Config(rate_pps=10), on_found=lambda f: None, cancelled=ev,
                        transport_factory=net)
    assert stats.cancelled and stats.sent == 0
    t0 = time.monotonic()
    stats = sweep.sweep([f"10.77.0.{i}" for i in range(1, 200)], config=sweep.Config(rate_pps=10, deadline_s=0.3), on_found=lambda f: None,
                        cancelled=threading.Event(), transport_factory=net)
    assert stats.timed_out and stats.sent < 10 and time.monotonic() - t0 < 3


def test_http_fallback_is_bounded_and_only_for_silent_addresses(monkeypatch):
    devs = devices()
    net = FakeNetwork(devs)
    net.http_delay_s = 0.02
    monkeypatch.setattr(onvif_http, "TRANSPORT", net.transport())
    targets = [f"10.77.0.{i}" for i in range(65, 95)]
    found, stats = _sweep(net, targets, http_fallback=True)
    http_found = [f for f in found if f.engine == "http"]
    assert [f.address for f in http_found] == ["10.77.0.90"] and http_found[0].clock_offset_s is not None
    asked = {h for h, a in net.http_requests}
    assert "10.77.0.71" not in asked and len(asked) == len(targets) - 7 and stats.http_checked == len(asked)
    assert {a for _, a in net.http_requests} == {"GetSystemDateAndTime"}  # no credentials, no other action
    assert net.http_max_in_flight <= sweep.HTTP_WORKERS


def test_a_real_loopback_socket_pair():
    """The real UdpTransport against a responder on 127.0.0.1 only (the range policy is not in play: the sweep is called directly)."""
    responder = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    responder.bind(("127.0.0.1", 0))
    responder.settimeout(3)
    port = responder.getsockname()[1]
    dev = FakeOnvifDevice("127.0.0.1", "urn:uuid:loop", scopes=hik_scopes("DS-2CD2143G2-I"))

    def answer():
        with contextlib.suppress(OSError):
            data, src = responder.recvfrom(65535)
            import re
            mid = re.search(rb"<w:MessageID>(uuid:[0-9a-f-]+)</w:MessageID>", data).group(1).decode()
            responder.sendto(probe_match(dev, mid), src)

    t = threading.Thread(target=answer, daemon=True)
    t.start()
    found = []
    try:
        sweep.sweep(["127.0.0.1"], config=sweep.Config(rate_pps=50, rounds=1, listen_s=1.0), on_found=found.append, cancelled=threading.Event(),
                    transport_factory=lambda: sweep.UdpTransport(port=port))
    finally:
        t.join(timeout=3)
        responder.close()
    assert [f.address for f in found] == ["127.0.0.1"] and found[0].match.model == "DS-2CD2143G2-I"


# ================================================================ known devices

def test_the_fingerprints_match_autosync(env):
    with env.db.connection() as conn:
        fp = autosync.fingerprint(conn, "nvr-1", "DS-2CD", "SER1")
        ident = autosync.device_identity(conn, "DS-7608", "SER2")
        salt = known.snapshot(conn, env.settings).salt
    assert known.camera_fingerprint(salt, "nvr-1", "DS-2CD", "SER1") == fp
    assert known.recorder_identity(salt, "DS-7608", "SER2") == ident


def test_the_recorder_reports_its_camera_addresses_in_memory(monkeypatch):
    ns = 'xmlns="http://www.hikvision.com/ver20/XMLSchema"'
    docs = {"/ISAPI/ContentMgmt/InputProxy/channels": f"<InputProxyChannelList {ns}><InputProxyChannel><id>1</id><name>c1</name>"
            "<sourceInputPortDescriptor><addressingFormatType>ipaddress</addressingFormatType><ipAddress>10.77.0.74</ipAddress>"
            "<model>DS-2CD1023G0</model><serialNumber>S1</serialNumber></sourceInputPortDescriptor></InputProxyChannel>"
            "<InputProxyChannel><id>2</id><name>c2</name></InputProxyChannel></InputProxyChannelList>"}
    monkeypatch.setattr(nvr, "_client", lambda s, *a, **k: contextlib.nullcontext(None))
    monkeypatch.setattr(nvr, "_get", lambda client, path: docs.get(path, ""))
    chans = nvr.discover_channels(SimpleNamespace())
    assert [c.device_address for c in chans] == ["10.77.0.74", None] and "10.77.0.74" not in repr(chans)
    known.note_channel_hosts("nvr-1", [c.device_address for c in chans] + ["cam.lan", "012.77.0.75"])
    assert known.CHANNEL_HOSTS["nvr-1"] == frozenset({"10.77.0.74", "10.77.0.75"})  # names are dropped, spellings normalised
    known.note_channel_hosts("nvr-1", [None])
    assert "nvr-1" not in known.CHANNEL_HOSTS


# ================================================================ the scan job (service)

def test_a_scan_finds_marks_and_audits(env, caplog):
    caplog.set_level(logging.DEBUG)
    known.note_channel_hosts("nvr-1", ["10.77.0.74"])
    cam = seed_standalone(env, "10.77.0.75")
    job = scan(env)
    assert job["state"] == "done" and job["range"] == RANGE and job["progress"] == {"checked": 30, "total": 30}
    d = by_addr(job)
    assert set(d) == {"10.77.0.71", "10.77.0.72", "10.77.0.73", "10.77.0.74", "10.77.0.75", "10.77.0.80", "10.77.0.81"}
    assert (d["10.77.0.71"]["kind"], d["10.77.0.71"]["known"], d["10.77.0.71"]["addable"]) == ("camera", "none", True)
    assert (d["10.77.0.71"]["manufacturer"], d["10.77.0.71"]["model"]) == ("HIKVISION", "DS-2CD2143G2-I")
    assert (d["10.77.0.74"]["known"], d["10.77.0.74"]["known_ref"], d["10.77.0.74"]["addable"]) == ("behind_recorder", "nvr-1", False)
    assert (d["10.77.0.75"]["known"], d["10.77.0.75"]["known_ref"], d["10.77.0.75"]["addable"]) == ("standalone", cam, False)
    assert (d["10.77.0.80"]["kind"], d["10.77.0.80"]["addable"]) == ("nvr", False)
    assert d["10.77.0.81"]["kind"] == "nvr"
    assert job["counts"] == {"found": 7, "cameras": 5, "recorders": 2, "unknown": 0, "known": 2, "addable": 3}
    [row] = audit_rows(env.settings, "camera.discovery.scan")
    det = json.loads(row["details_json"])
    assert row["decision"] == "allowed" and row["actor_username"] == "joni" and row["resource_id"] == job["id"]
    assert det["range"] == RANGE and det["addresses"] == 30 and det["state"] == "done" and det["found"] == 7 and det["engines"] == ["unicast"]
    blob = json.dumps(job) + json.dumps(audit_details(env.settings, "camera.discovery.scan")) + caplog.text
    for secret in ("urn:uuid:aaaa", *SERIALS):
        assert secret not in blob


def test_a_recorder_already_connected_is_marked(env, monkeypatch):
    import dataclasses
    s = dataclasses.replace(env.settings, nvr_host="10.77.0.80", nvr_vendor="hikvision")
    with env.db.connection() as conn:
        job = env.m.start_scan(conn, s, ADMIN, RANGE)
    d = by_addr(job)["10.77.0.80"]
    assert (d["kind"], d["known"], d["known_ref"], d["addable"]) == ("nvr", "recorder", "nvr-1", False)


def test_http_fallback_setting_adds_the_second_engine(env):
    with env.db.connection() as conn:
        set_setting(conn, svc.K_HTTP, "on")
    job = scan(env)
    d = by_addr(job)["10.77.0.90"]
    assert d["engines"] == ["http"] and d["kind"] == "unknown" and d["addable"] is True and job["engines"] == ["unicast", "http"]


def test_who_may_scan(env):
    for call in (lambda c: env.m.start_scan(c, env.settings, EVE, RANGE), lambda c: env.m.capabilities(c, env.settings, EVE)):
        with pytest.raises(ApiError) as e:
            with env.db.connection() as conn:
                call(conn)
        assert e.value.status == 403
    assert [r["decision"] for r in audit_rows(env.settings, "system.configure")] == ["denied", "denied"]
    assert env.net.sent == []
    job = scan(env)
    for call in (lambda c: env.m.get(c, EVE, job["id"]), lambda c: env.m.cancel(c, EVE, job["id"]),
                 lambda c: env.m.identify(c, env.settings, EVE, job["id"], device_ids=[job["devices"][0]["id"]], username="a", password="b")):
        with pytest.raises(ApiError) as e:
            with env.db.connection() as conn:
                call(conn)
        assert e.value.status == 403


def test_refusals_are_audited_and_send_nothing(env):
    def refused(rng, code, status):
        with pytest.raises(ApiError) as e:
            scan(env, rng)
        assert (e.value.status, e.value.code) == (status, code)

    refused("10.0.0.0/24", "range_refused", 422)  # an arbitrary private range (Q56)
    refused("10.77.0.0/21", "range_too_large", 422)
    refused("not a range", "range_invalid", 422)
    with env.db.connection() as conn:
        set_setting(conn, svc.K_MODE, "off")
    refused(RANGE, "discovery_off", 409)
    rows = audit_rows(env.settings, "camera.discovery.scan")
    assert [(r["decision"], r["reason"]) for r in rows] == [("denied", "range_refused"), ("denied", "range_too_large"), ("denied", "range_invalid"),
                                                           ("denied", "discovery_off")]
    assert env.net.sent == []


def test_no_site_network_fails_closed(env, monkeypatch):
    monkeypatch.setattr(ranges, "SITE_INTERFACES", lambda s: [])
    ranges._reset_for_tests()
    with pytest.raises(ApiError) as e:
        scan(env, None)
    assert e.value.code == "site_network_unknown"
    with env.db.connection() as conn:
        caps = env.m.capabilities(conn, env.settings, ADMIN)
    assert caps["engines"] == [{"id": "unicast", "available": False, "reason": "site_network_unknown"}] and caps["suggested_range"] is None


def test_capabilities_and_the_suggested_range(env):
    with env.db.connection() as conn:
        set_setting(conn, svc.K_RANGE_MAX, "/24")
        caps = env.m.capabilities(conn, env.settings, ADMIN)
    assert caps == {"enabled": True, "engines": [{"id": "unicast", "available": True}], "suggested_range": "10.77.0.0/24", "max_addresses": 256,
                    "running": False}


def test_one_scan_at_a_time_and_cancel(env):
    env.m.run_inline = False
    env.m.listen_s = 30.0  # stays in its listen window until cancelled
    job = scan(env)
    assert job["state"] == "running"
    with pytest.raises(ApiError) as e:
        scan(env)
    assert e.value.code == "scan_running"
    with env.db.connection() as conn:
        assert env.m.cancel(conn, ADMIN, job["id"]) == {"cancelled": True}
    for t in env.m._threads:
        t.join(timeout=5)
    with env.db.connection() as conn:
        view = env.m.get(conn, ADMIN, job["id"])
    assert view["state"] == "cancelled"
    assert json.loads(audit_rows(env.settings, "camera.discovery.scan")[0]["details_json"])["state"] == "cancelled"
    assert [r["decision"] for r in audit_rows(env.settings, "camera.discovery.cancel")] == ["allowed"]
    with pytest.raises(ApiError) as e:
        identify(env, job, [view["devices"][0]["id"]] if view["devices"] else ["dx"])
    assert e.value.code == "scan_not_active"


def test_scan_rate_limits(env):
    for _ in range(svc.SCANS_PER_10MIN_USER):
        scan(env)
    with pytest.raises(ApiError) as e:
        scan(env)
    assert (e.value.status, e.value.code) == (429, "rate_limited") and e.value.details["retry_after_s"] > 0
    assert audit_rows(env.settings, "camera.discovery.scan")[-1]["reason"] == "rate_limited"


def test_the_job_expires_and_forgets_the_credentials(env):
    shift = [0.0]
    env.m.clock = lambda: time.monotonic() + shift[0]  # the sweep paces on this clock too: it must run
    job = scan(env)
    d = by_addr(job)
    identify(env, job, [d["10.77.0.71"]["id"]])
    with env.db.connection() as conn:
        creds = env.m.credentials_for(conn, ADMIN, job["id"], d["10.77.0.71"]["id"])
    assert creds is not None and creds[1:] == (USER, PASSWORD) and creds[0].address == "10.77.0.71"
    internal = env.m._jobs[job["id"]]
    shift[0] += 16 * 60
    with pytest.raises(ApiError) as e:
        with env.db.connection() as conn:
            env.m.get(conn, ADMIN, job["id"])
    assert e.value.code == "scan_not_found"
    assert all(dev.creds is None for dev in internal.devices.values())


# ================================================================ identification: one attempt per camera (Q57)

def test_same_password_for_all_one_attempt_each(env, caplog):
    caplog.set_level(logging.DEBUG)
    known.note_channel_hosts("nvr-1", ["10.77.0.74"])
    env.net.devices["10.77.0.72"].password = "Different-2"
    job = scan(env)
    d = by_addr(job)
    ids = [d[a]["id"] for a in ("10.77.0.71", "10.77.0.72", "10.77.0.73", "10.77.0.74", "10.77.0.80")]
    out = identify(env, job, ids)
    res = by_addr(out)
    assert res["10.77.0.71"]["auth"] == "ok" and res["10.77.0.71"]["firmware"] == "V5.7.3 build 220112"
    assert res["10.77.0.73"]["auth"] == "ok" and 595 <= res["10.77.0.73"]["clock_offset_s"] <= 605  # digest on the camera's clock
    assert res["10.77.0.72"]["auth"] == "wrong_password"
    assert res["10.77.0.74"]["auth"] == "skipped" and res["10.77.0.80"]["auth"] == "skipped"  # Q58 / Q59: never sent the password
    auth = {a: dev.auth_requests for a, dev in env.net.devices.items()}
    assert auth == {"10.77.0.71": 1, "10.77.0.72": 1, "10.77.0.73": 1, "10.77.0.74": 0, "10.77.0.75": 0, "10.77.0.80": 0, "10.77.0.81": 0, "10.77.0.90": 0}
    assert env.net.devices["10.77.0.74"].actions == [] and env.net.devices["10.77.0.80"].actions == []
    # the same pair again: the camera that refused it is NOT contacted again
    identify(env, job, [d["10.77.0.72"]["id"]], same=False)
    assert env.net.devices["10.77.0.72"].auth_requests == 1
    # a new password: exactly one more attempt
    out = identify(env, job, [d["10.77.0.72"]["id"]], password="Different-2", same=False)
    assert out["devices"][0]["auth"] == "ok" and env.net.devices["10.77.0.72"].auth_requests == 2
    [*_, last] = audit_details(env.settings, "camera.discovery.identify")
    first = audit_details(env.settings, "camera.discovery.identify")[0]
    assert first == {"devices": 5, "same_for_all": True, "results": {"ok": 2, "skipped": 2, "wrong_password": 1}} and last["results"] == {"ok": 1}
    blob = (json.dumps(out) + json.dumps(job) + caplog.text + json.dumps([dict(r) for r in audit_rows(env.settings, "camera.discovery.identify")])
            + json.dumps(audit_details(env.settings, "camera.discovery.scan")))
    for secret in (PASSWORD, "Different-2", *SERIALS):
        assert secret not in blob
    assert '"admin"' not in json.dumps(audit_details(env.settings, "camera.discovery.identify"))


def test_the_lockout_guard_stops_after_three_refusals(env):
    env.net.devices["10.77.0.71"].lock_after = 5
    job = scan(env)
    cam = by_addr(job)["10.77.0.71"]["id"]
    for i in range(svc.GUARD_FAILURES):
        assert identify(env, job, [cam], password=f"bad-{i}", same=False)["devices"][0]["auth"] == "wrong_password"
    assert env.net.devices["10.77.0.71"].auth_requests == 3
    out = identify(env, job, [cam], password=PASSWORD, same=False)
    assert out["devices"][0]["auth"] == "locked_guard" and env.net.devices["10.77.0.71"].auth_requests == 3  # not contacted
    job2 = scan(env)  # a new scan does not reset the guard
    out = identify(env, job2, [by_addr(job2)["10.77.0.71"]["id"]], password=PASSWORD, same=False)
    assert out["devices"][0]["auth"] == "locked_guard" and env.net.devices["10.77.0.71"].failures == 3  # the camera never reached its lock


def test_identification_marks_by_fingerprint(env):
    with env.db.connection() as conn:
        rid_fp = autosync.device_identity(conn, "DS-2CD2143G2-I", SERIALS[0])  # pretend .71 is a known recorder's identity
        conn.execute("INSERT INTO recorders(id, name, created_at) VALUES ('nvr-7', 'R', ?)", (now_iso(),))
        conn.execute("UPDATE recorders SET device_fingerprint = ? WHERE id = 'nvr-7'", (rid_fp,))
        cam_fp = autosync.fingerprint(conn, "nvr-1", "IPC-HDW2431T", SERIALS[1])
        cid = new_id()
        conn.execute("INSERT INTO recorders(id, name, created_at) VALUES ('nvr-1', 'N', ?) ON CONFLICT(id) DO NOTHING", (now_iso(),))
        conn.execute("INSERT INTO cameras(id, recorder_id, channel, name_source, sort_order, status, created_at, updated_at, device_fingerprint) "
                     "VALUES (?, 'nvr-1', 5, '', 5, 'online', ?, ?, ?)", (cid, now_iso(), now_iso(), cam_fp))
    job = scan(env)
    d = by_addr(job)
    out = by_addr(identify(env, job, [d["10.77.0.71"]["id"], d["10.77.0.72"]["id"]]))
    assert (out["10.77.0.71"]["known"], out["10.77.0.71"]["kind"], out["10.77.0.71"]["addable"]) == ("recorder", "nvr", False)
    assert (out["10.77.0.72"]["known"], out["10.77.0.72"]["known_ref"], out["10.77.0.72"]["addable"]) == ("behind_recorder", "nvr-1", False)
    with env.db.connection() as conn:
        assert env.m.credentials_for(conn, ADMIN, job["id"], d["10.77.0.72"]["id"]) is None  # not addable: the password is not kept


def test_identify_input_rules(env):
    job = scan(env)
    d = by_addr(job)
    two = [d["10.77.0.71"]["id"], d["10.77.0.72"]["id"]]
    cases = [(dict(device_ids=two, same=False), "same_for_all_required"), (dict(device_ids=["nope"]), "device_unknown"),
             (dict(device_ids=[]), "device_unknown"), (dict(device_ids=two, password=""), "credentials_invalid"),
             (dict(device_ids=two, user=" "), "credentials_invalid"), (dict(device_ids=two, password="x" * 200), "credentials_invalid")]
    for kw, code in cases:
        ids = kw.pop("device_ids")
        with pytest.raises(ApiError) as e:
            identify(env, job, ids, **kw)
        assert e.value.code == code
    assert sum(dev.auth_requests for dev in env.net.devices.values()) == 0


def test_identify_press_rate_limit(env):
    job = scan(env)
    cam = by_addr(job)["10.77.0.81"]["id"]  # a recorder: skipped, nothing is sent
    for _ in range(svc.IDENTIFY_PER_10MIN_USER):
        identify(env, job, [cam], same=False)
    with pytest.raises(ApiError) as e:
        identify(env, job, [cam], same=False)
    assert e.value.code == "rate_limited"


def test_no_weekly_job_and_nothing_written_to_devices():
    """Q60: no periodic scan exists; Q61 / D9: the package builds no write action and never calls go2rtc or the NVR."""
    root = Path(svc.__file__).parent
    src = "".join(p.read_text(encoding="utf-8") for p in root.glob("*.py"))
    for forbidden in ("PeriodicWorker", "schedule", "go2rtc.Go2rtc", "nvr_settings", "provision", "put_stream", "/api/streams"):
        assert forbidden not in src, forbidden
