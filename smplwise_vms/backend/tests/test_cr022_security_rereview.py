"""CR-022: regression tests for the second, independent security review of the NN4 fixes (findings N1, N2, N3, N6, N9,
2026-10-04). Every device is a fake: httpx MockTransports, a recording probe, or a small socket server of this test bound to
127.0.0.1 and called directly by `probe()` (the source policy is not involved there). Nothing contacts a real NVR, Home
Assistant or any other network. 198.51.100.0/24 is an RFC 5737 documentation range, never routed. Passwords are canaries."""
from __future__ import annotations

import dataclasses
import socket
import threading
import time

import httpx
import pytest
from conftest import as_user
from fastapi.testclient import TestClient
from test_nvr_connection import API, CANARY, GOOD, fake, j, rows, world  # noqa: F401

from smplwise.main import create_app
from smplwise.services import connection_probe


def _recording_probe(monkeypatch):
    seen: list[str] = []
    monkeypatch.setattr(connection_probe, "probe", lambda cand: seen.append(f"{cand.nvr_host}:{cand.nvr_password}") or {"ok": True, "code": "ok", "model": "m", "firmware": "f", "channels": 1})
    return seen


# ---------------------------------------------------------------- N1: no stored destination = no stored password at all

def test_n1_without_a_stored_destination_no_stored_password_is_used(world, fake, settings, monkeypatch):
    """No stored row and no legacy host, but a legacy password in the process (an NVR-less installation whose options still
    carry nvr_password, or a developer NVR_PASSWORD): "use the stored password" must never send it anywhere."""
    world  # the administrator exists
    s = dataclasses.replace(settings, nvr_host=None, nvr_password=CANARY, nvr_from_options=False)
    c = TestClient(create_app(s))
    assert rows(s, "SELECT recorder_id FROM recorder_connections") == []
    seen = _recording_probe(monkeypatch)
    keep = {k: v for k, v in GOOD.items() if k != "password"}
    r = c.post(API + "/test", headers=as_user("joni"), json={**keep, "host": "198.51.100.9", "use_stored_password": True})
    assert r.status_code == 422 and r.json()["code"] == "password_required", r.text
    r = j(c, "put", json={**keep, "host": "198.51.100.9"})  # keep_password defaults to true
    assert r.status_code == 422 and r.json()["code"] == "password_required", r.text
    # an explicit "no NVR" row has no destination either
    assert j(c, "put", json={"vendor": "none"}).status_code == 200
    r = c.post(API + "/test", headers=as_user("joni"), json={**keep, "host": "198.51.100.9", "use_stored_password": True})
    assert r.status_code == 422 and r.json()["code"] == "password_required", r.text
    assert seen == [], "the legacy password reached the probe"
    assert CANARY not in r.text


# ---------------------------------------------------------------- N2: a hard outer deadline, also while waiting for headers

class _ContinueServer:
    """Accepts one connection on 127.0.0.1 and sends `100 Continue` every 0.3 s, never a final answer, until the client goes."""

    def __init__(self) -> None:
        self.sock = socket.socket()
        self.sock.bind(("127.0.0.1", 0))
        self.sock.listen(4)
        self.port = self.sock.getsockname()[1]
        self.client_gone = threading.Event()
        self.stop = threading.Event()
        self.thread = threading.Thread(target=self._run, name="test-continue-server", daemon=True)
        self.thread.start()

    def _run(self) -> None:
        self.sock.settimeout(10)
        try:
            conn, _ = self.sock.accept()
        except OSError:
            return
        with conn:
            conn.settimeout(0.3)
            while not self.stop.is_set():
                try:
                    data = conn.recv(4096)
                    if data == b"":
                        break  # the client closed its side
                except TimeoutError:
                    pass
                except OSError:
                    break
                try:
                    conn.sendall(b"HTTP/1.1 100 Continue\r\n\r\n")
                except OSError:
                    break
        self.client_gone.set()

    def close(self) -> None:
        self.stop.set()
        self.sock.close()


def test_n2_an_endless_interim_answer_ends_at_the_hard_deadline_and_the_socket_is_closed(settings, monkeypatch):
    monkeypatch.setattr(connection_probe, "TRANSPORT", None)
    monkeypatch.setattr(connection_probe, "DEADLINE_S", 2.0)
    monkeypatch.setattr(connection_probe, "READ_S", 1.0)  # each 1xx arrives within the per-read timeout: only the deadline can stop it
    srv = _ContinueServer()
    try:
        cand = connection_probe.candidate(settings, vendor="hikvision", target="127.0.0.1", http_port=srv.port, rtsp_port=554, username="u", password="p")
        t0 = time.monotonic()
        res = connection_probe.probe(cand)
        took = time.monotonic() - t0
        assert res == {"ok": False, "code": "timeout"}, res
        assert took < 2.0 + 1.5, f"the probe returned after {took:.1f} s (deadline 2 s)"
        assert srv.client_gone.wait(3.0), "the probe's socket was not closed after the deadline"
        time.sleep(0.2)
        assert not [t for t in threading.enumerate() if t.name.startswith("nvr-probe") and t.is_alive()], "the probe's worker is still running"
    finally:
        srv.close()


# ---------------------------------------------------------------- N3: no compressed answers (no decompression before the cap)

def test_n3_identity_encoding_is_asked_and_a_compressed_answer_is_refused(settings, monkeypatch):
    seen: list[str | None] = []
    import gzip

    bomb = gzip.compress(b"<DeviceInfo><model>" + b"x" * (4 * 1024 * 1024) + b"</model></DeviceInfo>")

    def handler(req: httpx.Request) -> httpx.Response:
        seen.append(req.headers.get("accept-encoding"))
        return httpx.Response(200, headers={"content-encoding": "gzip"}, content=bomb)

    monkeypatch.setattr(connection_probe, "TRANSPORT", httpx.MockTransport(handler))
    cand = connection_probe.candidate(settings, vendor="hikvision", target="192.0.2.80", http_port=80, rtsp_port=554, username="u", password="p")
    assert connection_probe.probe(cand) == {"ok": False, "code": "source_error"}
    assert seen and all(v == "identity" for v in seen), seen


def test_n3_raw_bytes_are_counted_against_the_cap(settings, monkeypatch):
    """Without a content-encoding header the body is read raw: a gzip-looking body is never inflated."""
    import gzip

    bomb = gzip.compress(b"x" * (8 * 1024 * 1024))
    monkeypatch.setattr(connection_probe, "TRANSPORT", httpx.MockTransport(lambda req: httpx.Response(200, content=bomb)))
    cand = connection_probe.candidate(settings, vendor="hikvision", target="192.0.2.80", http_port=80, rtsp_port=554, username="u", password="p")
    assert connection_probe.probe(cand) == {"ok": False, "code": "source_error"}, "unparsable raw bytes, not an 8 MB inflated string"


# ---------------------------------------------------------------- N9: no proxy from the environment; N6: the whole local-use NAT64 range

def test_n9_the_probe_client_ignores_proxy_environment(settings, monkeypatch):
    monkeypatch.setenv("HTTP_PROXY", "http://198.51.100.1:3128")
    monkeypatch.setenv("ALL_PROXY", "http://198.51.100.1:3128")
    cand = connection_probe.candidate(settings, vendor="hikvision", target="192.0.2.80", http_port=80, rtsp_port=554, username="u", password="p")
    with connection_probe.probe_client(cand) as client:
        assert client.trust_env is False


@pytest.mark.parametrize("host", ["64:ff9b:1::c0a8:132", "64:ff9b:1:7f00:1::", "64:ff9b:1:ffff::1"])
def test_n6_the_local_use_nat64_range_is_refused_whole(settings, fake, host):
    with pytest.raises(Exception) as exc:
        connection_probe.connect_target(host, settings)
    assert getattr(exc.value, "code", None) == "host_refused", host
