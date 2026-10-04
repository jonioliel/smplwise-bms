"""CR-025: the add-on side of Provision-ISR push events (fake device and localhost only; no NVR is touched): the 18091/tcp
mapping (unmapped by default), per-recorder registration with a path token or the source address, the address the add-on
advertises, configure_push following the device's own form, and the fallback to sampling."""
from __future__ import annotations

import sys
import time
from pathlib import Path

import httpx
import pytest
import yaml

from smplwise.services.recorders import provision_events as pe
from smplwise.services.recorders import provision_isr as pisr
from smplwise.services.recorders.provision_push import PushListener, PushReceiver

sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from fake_provision import FakeProvision, settings_for  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
STATUS = b"""<config version="1.0" xmlns="http://www.ipc.com/ver10"><alarmStatusInfo><motionAlarm type="boolean" id="3">true</motionAlarm></alarmStatusInfo></config>"""


@pytest.fixture()
def fake() -> FakeProvision:
    pisr.clear_auth_cache()
    return FakeProvision()


def test_port_is_declared_and_unmapped_by_default():
    cfg = yaml.safe_load((ROOT / "config.yaml").read_text(encoding="utf-8"))
    assert "18091/tcp" in cfg["ports"] and cfg["ports"]["18091/tcp"] is None
    assert "Provision" in cfg["ports_description"]["18091/tcp"]


def test_push_token_is_per_recorder_and_stable(settings):
    a1, a2 = pe.push_token(settings, "nvr-1"), pe.push_token(settings, "nvr-2")
    assert a1 and a2 and a1 != a2 and len(a1) == 32 and pe.push_token(settings, "nvr-1") == a1


def test_push_target_configured_and_detected(settings, monkeypatch):
    s = settings_for(settings, push_advertise_host="ha.local.test", push_advertise_port=28091)
    t = pe.push_target(s, "nvr-2")
    assert (t["host"], t["port"], t["auth"], t["advertise_source"], t["listen_port"]) == ("ha.local.test", 28091, "token", "configured", 18091)
    assert t["path"] == f"/{pe.push_token(s, 'nvr-2')}/SendAlarmStatus"
    monkeypatch.setattr(pe, "_local_address_towards", lambda host: "192.0.2.5")
    d = pe.push_target(settings_for(settings, push_auth="address"), "nvr-2")
    assert (d["host"], d["advertise_source"], d["path"]) == ("192.0.2.5", "detected", "/SendAlarmStatus")


def _post(port: int, path: str, body: bytes = STATUS) -> int:
    with httpx.Client(timeout=5) as c:
        return c.post(f"http://127.0.0.1:{port}{path}", content=body).status_code


def test_listener_token_routing_and_refusals():
    got = []
    rx2, rx3 = PushReceiver("nvr-2"), PushReceiver("nvr-3")
    lst = PushListener({}, lambda rid, alerts: got.append(rid), host="127.0.0.1", port=0,
                       tokens={"tok2": (rx2, None), "tok3": (rx3, "192.0.2.99")})
    lst.start()
    try:
        assert _post(lst.port, "/tok2/SendAlarmStatus") == 200
        assert _post(lst.port, "/tok2") == 200  # a device that posts to the bare url path
        assert _post(lst.port, "/nope/SendAlarmStatus") == 403
        assert _post(lst.port, "/SendAlarmStatus") == 403  # no token, no address registration
        assert _post(lst.port, "/tok3/SendAlarmStatus") == 403  # token_and_address: right token, wrong source
    finally:
        lst.stop()
    assert got == ["nvr-2"] and lst.refused == 3, "the second push of the same level is not a new event"


def test_register_push_token_mode_and_address_mode(settings, monkeypatch):
    class L:
        def __init__(self, s, rid):
            self.settings, self.recorder_id = s, rid

    started = []

    class FakeListener:
        def __init__(self, sources, sink, host, port, tokens=None):
            self.sources, self.tokens = dict(sources), dict(tokens or {})
            started.append(port)

        def start(self):
            pass

        def stop(self):
            pass

    monkeypatch.setattr(pe, "PushListener", FakeListener)
    monkeypatch.setattr(pe.socket, "gethostbyname", lambda h: "192.0.2.50")
    pe.stop_push()
    try:
        rx = pe._register_push(L(settings_for(settings), "nvr-2"), None)
        assert rx is not None and started == [18091]
        assert pe._PUSH.tokens[pe.push_token(settings, "nvr-2")][0] is rx and pe._PUSH.sources == {}
        rx3 = pe._register_push(L(settings_for(settings, push_auth="address"), "nvr-3"), None)
        assert pe._PUSH.sources["192.0.2.50"] is rx3
        assert started == [18091], "one listener for every recorder"
    finally:
        pe.stop_push()


def test_configure_push_follows_the_device_form(settings, fake):
    """Live shape (address + port only): no heartbeat, no url element is sent; a v2-style form with `url` gets the token path."""
    fake.shape = "live"
    a = pisr.ProvisionIsrAdapter("nvr-2", settings_for(settings, writes_enabled=True, auth="basic"), transport=fake.transport())
    out = a.configure_push("ha.local.test", 18091, path="/abc123/SendAlarmStatus")
    assert out["applied"] is True and out["path_supported"] is False and out["previous"] == {"configured": False, "port": None}
    body = fake.set_alarm_bodies[-1]
    assert "<serverAddr>" in body and "<serverPort>18091</serverPort>" in body and "enableHeartbeat" not in body and "<url>" not in body
    fake.alarm_server_url = True
    out = a.configure_push("ha.local.test", 18091, path="/abc123/SendAlarmStatus")
    assert out["path_supported"] is True and "<url><![CDATA[/abc123/SendAlarmStatus]]></url>" in fake.set_alarm_bodies[-1]
    with pytest.raises(Exception):
        a.configure_push("ha.local.test", 18091, path="/bad path")


def test_push_off_by_default_and_fallback_to_sampling(settings, fake, monkeypatch):
    assert pisr.ProvisionIsrAdapter("nvr-2", settings_for(settings)).event_mode() == "poll"

    class FL:
        def __init__(self, s):
            import threading

            from smplwise.services import events_ingest

            self.settings, self.recorder_id, self.state, self.db = s, "nvr-2", events_ingest.IngestState(), None
            self.stop, self.got, self.rounds = threading.Event(), [], 3
            self.tz_getter = lambda: "Asia/Jerusalem"

        def submit(self, a):
            self.got.append(a)

        def sleep(self, sec):
            self.rounds -= 1
            if self.rounds <= 0:
                self.stop.set()
            return self.stop.is_set()

    s = settings_for(settings, auth="basic", event_mode="push")
    rx = PushReceiver("nvr-2", heartbeat_s=10)
    rx.last_message = time.monotonic() - 100  # silent push path
    monkeypatch.setattr(pe, "_register_push", lambda listener, adapter: rx)
    fl = FL(s)
    fake.alarms = {("motionAlarm", 2): True}
    pe.run_loop(fl, adapter=pisr.ProvisionIsrAdapter("nvr-2", s, transport=fake.transport()), sleep=fl.sleep)
    assert any(a.raw_type == "VMD" for a in fl.got) and any("GetAlarmStatus" in h for h in fake.hits)


# ---------------------------------------------------------------------------------------------- security review M1 / M2 / L4

import socket as _socket  # noqa: E402
from smplwise.services.recorders import provision_push as ppush  # noqa: E402


def _listener(monkeypatch, **consts):
    for k, v in consts.items():
        monkeypatch.setattr(ppush, k, v)
    got = []
    rx = PushReceiver("nvr-2")
    lst = PushListener({}, lambda rid, alerts: got.append(rid), host="127.0.0.1", port=0, tokens={"tok": (rx, None)})
    lst.start()
    return lst, got


def test_slow_header_client_is_cut_off(monkeypatch):
    lst, _ = _listener(monkeypatch, HANDLER_TIMEOUT_S=0.5)
    try:
        s = _socket.create_connection(("127.0.0.1", lst.port), timeout=5)
        s.sendall(b"POST /tok/SendAlarmStatus HTTP/1.1\r\nHost: x\r\n")  # headers never finished
        t0 = time.monotonic()
        data = s.recv(1024)  # the server closes the connection after its timeout
        assert time.monotonic() - t0 < 4 and (data == b"" or b"408" in data or b"400" in data)
        s.close()
    finally:
        lst.stop()


def test_connections_per_source_are_capped(monkeypatch):
    lst, _ = _listener(monkeypatch, MAX_PER_SOURCE=2, HANDLER_TIMEOUT_S=5)
    socks = []
    try:
        for _ in range(2):
            s = _socket.create_connection(("127.0.0.1", lst.port), timeout=5)
            s.sendall(b"POST /tok HTTP/1.1\r\n")  # held open, unfinished
            socks.append(s)
        time.sleep(0.3)
        extra = _socket.create_connection(("127.0.0.1", lst.port), timeout=5)
        try:
            extra.sendall(b"POST /tok HTTP/1.0\r\nContent-Length: 0\r\n\r\n")
            data = extra.recv(1024)
        except OSError:  # Windows reports the closed socket as an abort
            data = b""
        assert data == b"", "refused at accept: closed without an answer"
        extra.close()
        assert lst.limited >= 1
    finally:
        for s in socks:
            s.close()
        lst.stop()


def test_rate_limit_per_source(monkeypatch):
    lst, got = _listener(monkeypatch, RATE_PER_SOURCE=1)
    try:
        with httpx.Client(timeout=5) as c:
            codes = [c.post(f"http://127.0.0.1:{lst.port}/tok/SendAlarmStatus", content=STATUS).status_code for _ in range(6)]
        assert codes[0] == 200 and 429 in codes[1:], codes
    finally:
        lst.stop()


def test_no_keep_alive(monkeypatch):
    lst, _ = _listener(monkeypatch)
    try:
        with httpx.Client(timeout=5) as c:
            r = c.post(f"http://127.0.0.1:{lst.port}/tok/SendAlarmStatus", content=STATUS)
        assert r.status_code == 200 and r.http_version == "HTTP/1.0"
    finally:
        lst.stop()


class _L:
    def __init__(self, s, rid):
        self.settings, self.recorder_id = s, rid


def test_address_mode_refused_for_a_second_recorder_on_the_same_address(settings, monkeypatch):
    monkeypatch.setattr(pe.socket, "gethostbyname", lambda h: "192.0.2.50")
    pe.stop_push()
    monkeypatch.setattr(ppush, "HANDLER_TIMEOUT_S", 1)
    real = pe.PushListener
    monkeypatch.setattr(pe, "PushListener", lambda sources, sink, host, port, tokens=None: real(sources, sink, host="127.0.0.1", port=0, tokens=tokens))
    try:
        rx2 = pe._register_push(_L(settings_for(settings, push_auth="address"), "nvr-2"), None)
        rx3 = pe._register_push(_L(settings_for(settings, push_auth="address"), "nvr-3"), None)
        assert rx2 is not None and rx3 is None, "the second recorder keeps sampling"
        assert pe._PUSH.sources["192.0.2.50"] is rx2
        # token mode still works for the second recorder behind the same address
        assert pe._register_push(_L(settings_for(settings), "nvr-3"), None) is not None
    finally:
        pe.stop_push()


def test_token_routes_only_to_its_recorder_and_is_dropped_on_stop(settings, monkeypatch):
    pe.stop_push()
    real = pe.PushListener
    monkeypatch.setattr(pe, "PushListener", lambda sources, sink, host, port, tokens=None: real(sources, sink, host="127.0.0.1", port=0, tokens=tokens))
    got = []

    class Sink:
        def __init__(self, rid):
            self.rid = rid

        def submit(self, a):
            got.append((self.rid, a.raw_type, a.channel))

    try:
        for rid in ("nvr-2", "nvr-3"):
            l = _L(settings_for(settings), rid)
            pe._register_push(l, None)
            pe._SINKS[rid] = Sink(rid)
        port = pe._PUSH.port
        tok2 = pe.push_token(settings, "nvr-2")
        assert _post(port, f"/{tok2}/SendAlarmStatus") == 200
        time.sleep(0.2)
        assert got == [("nvr-2", "VMD", 3)], "token A creates events only on A"
        pe.unregister_push("nvr-2")
        assert _post(port, f"/{tok2}/SendAlarmStatus") == 403
    finally:
        pe.stop_push()