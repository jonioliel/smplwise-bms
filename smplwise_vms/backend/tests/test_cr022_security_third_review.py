"""CR-022: regression tests for the third security review of the NVR connection feature (2026-10-04).

Every device is a fake: a small socket server of this test bound to 127.0.0.1 and called directly by `probe()` (the source
policy is not involved there), a patched `socket.getaddrinfo` (no DNS from a test) and the fake devices of
tests/fixtures/fake_devices.py. Nothing contacts a real NVR, Home Assistant or any other network. 192.0.2.0/24 and
198.51.100.0/24 are RFC 5737 documentation ranges, never routed. Passwords are canaries."""
from __future__ import annotations

import dataclasses
import gzip
import socket
import sqlite3
import threading
import time

import httpx
import pytest
from test_nvr_connection import CANARY, fake  # noqa: F401

from smplwise.main import create_app
from smplwise.services import connection_probe, connection_store
from smplwise.services import source_policy as sp

CHALLENGE = b'WWW-Authenticate: Digest realm="r", nonce="abc", qop="auth", algorithm=MD5\r\n'


class _ChallengeServer:
    """Answers every request on 127.0.0.1 with a Digest challenge (401) carrying `body` (and `extra` headers)."""

    def __init__(self, body: bytes, extra: bytes = b"") -> None:
        self.body, self.extra = body, extra
        self.sock = socket.socket()
        self.sock.bind(("127.0.0.1", 0))
        self.sock.listen(8)
        self.port = self.sock.getsockname()[1]
        self.stop = threading.Event()
        threading.Thread(target=self._run, name="test-challenge-server", daemon=True).start()

    def _run(self) -> None:
        self.sock.settimeout(0.5)
        while not self.stop.is_set():
            try:
                conn, _ = self.sock.accept()
            except OSError:
                continue
            threading.Thread(target=self._serve, args=(conn,), daemon=True).start()

    def _serve(self, conn: socket.socket) -> None:
        conn.settimeout(5)
        try:
            with conn:
                while True:
                    buf = b""
                    while b"\r\n\r\n" not in buf:
                        d = conn.recv(4096)
                        if not d:
                            return
                        buf += d
                    conn.sendall(b"HTTP/1.1 401 Unauthorized\r\n" + CHALLENGE + self.extra
                                 + f"Content-Length: {len(self.body)}\r\n\r\n".encode() + self.body)
        except OSError:
            return

    def close(self) -> None:
        self.stop.set()
        self.sock.close()


def _largest_read(monkeypatch) -> list[int]:
    sizes: list[int] = []
    orig = httpx.Response.read

    def read(self):
        out = orig(self)
        sizes.append(len(out))
        return out

    monkeypatch.setattr(httpx.Response, "read", read)
    return sizes


# ---------------------------------------------------------------- 1: the Digest challenge answer is capped and never inflated

def test_challenge_answer_is_not_capped(settings, monkeypatch):
    monkeypatch.setattr(connection_probe, "TRANSPORT", None)
    sizes = _largest_read(monkeypatch)
    srv = _ChallengeServer(b"x" * (8 * 1024 * 1024))
    try:
        cand = connection_probe.candidate(settings, vendor="hikvision", target="127.0.0.1", http_port=srv.port, rtsp_port=554, username="u", password="p")
        assert connection_probe.probe(cand)["code"] == "source_forbidden"
        assert max(sizes or [0]) <= connection_probe.MAX_BYTES, f"a challenge answer of {max(sizes)} bytes was read whole"
    finally:
        srv.close()


def test_challenge_answer_is_inflated(settings, monkeypatch):
    monkeypatch.setattr(connection_probe, "TRANSPORT", None)
    sizes = _largest_read(monkeypatch)
    bomb = gzip.compress(b"\0" * (64 * 1024 * 1024), 9)
    srv = _ChallengeServer(bomb, b"Content-Encoding: gzip\r\n")
    try:
        cand = connection_probe.candidate(settings, vendor="hikvision", target="127.0.0.1", http_port=srv.port, rtsp_port=554, username="u", password="p")
        res = connection_probe.probe(cand)
        assert res["ok"] is False and res["code"] == "source_error", res
        assert max(sizes or [0]) <= connection_probe.MAX_BYTES, f"a compressed challenge answer was inflated to {max(sizes)} bytes"
    finally:
        srv.close()


# ---------------------------------------------------------------- 2: a saturated resolver never means "allowed"; the probe has its own

@pytest.fixture()
def slow_dns(monkeypatch):
    """`slow*` names block until the test ends; `loop.example` is 127.0.0.1; anything else 192.0.2.5."""
    release = threading.Event()

    def getaddrinfo(host, *a, **k):
        if str(host).startswith("slow"):
            release.wait(10)
            raise socket.gaierror("no answer")
        addr = "127.0.0.1" if host == "loop.example" else "192.0.2.5"
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (addr, 0))]

    monkeypatch.setattr(socket, "getaddrinfo", getaddrinfo)
    yield release
    release.set()
    time.sleep(0.3)  # the abandoned lookups finish and free their workers before the next test


def test_slow_names_cannot_open_the_camera_source_policy(slow_dns):
    for i in range(4):
        assert sp.resolve_host(f"slow{i}.example", timeout=0.05) == []
    t0 = time.monotonic()
    assert sp.source_refusal("rtsp://loop.example:554/stream") == "source_not_allowed", "an unresolved name was allowed while the resolver was saturated"
    assert time.monotonic() - t0 < 1.0, "the refusal waited for a worker instead of failing closed"


def test_the_connection_probe_has_its_own_resolver(slow_dns, monkeypatch):
    for i in range(4):
        sp.resolve_host(f"slow{i}.example", timeout=0.05)
    assert connection_probe.RESOLVE("nvr.example") == ["192.0.2.5"], "the probe shares the camera source policy's saturated resolver"


# ---------------------------------------------------------------- 3: an unreadable store at start-up fails closed

def test_a_store_failure_at_startup_does_not_fall_back_to_the_add_on_options(settings, monkeypatch):
    def locked(*a, **k):
        raise sqlite3.OperationalError("database is locked")

    monkeypatch.setattr(connection_store, "load_effective", locked)
    s = dataclasses.replace(settings, nvr_host="198.51.100.9", nvr_user="viewer", nvr_password=CANARY, nvr_from_options=True)
    eff = create_app(s).state.settings
    assert eff.nvr_host is None and eff.nvr_password is None and eff.nvr_user is None
    assert eff.nvr_connection_state == "unreadable"


# ---------------------------------------------------------------- 4: cloud metadata over IPv6 and the shared address space

@pytest.mark.parametrize("host", ["fd20:ce::254", "100.64.0.1", "100.100.100.100", "100.127.255.254", "64:ff9b::6440:1"])
def test_metadata_and_shared_address_space_are_refused(settings, fake, monkeypatch, host):
    monkeypatch.delenv("SW_NVR_ALLOW_SHARED_ADDRESS_SPACE", raising=False)
    with pytest.raises(Exception) as exc:
        connection_probe.connect_target(host, settings)
    assert getattr(exc.value, "code", None) == "host_refused", host


def test_the_shared_address_space_override(settings, fake, monkeypatch):
    monkeypatch.setenv("SW_NVR_ALLOW_SHARED_ADDRESS_SPACE", "1")
    assert connection_probe.connect_target("100.64.0.1", settings) == "100.64.0.1"
    for host in ("100.100.100.200", "fd20:ce::254"):  # metadata stays refused with the override
        with pytest.raises(Exception) as exc:
            connection_probe.connect_target(host, settings)
        assert getattr(exc.value, "code", None) == "host_refused", host
    assert connection_probe.connect_target("100.63.255.255", settings) == "100.63.255.255"  # just outside the range: never refused


# ---------------------------------------------------------------- 5: name resolution is inside the one 8 s budget

def test_name_resolution_is_inside_the_probe_budget(settings, slow_dns, monkeypatch):
    monkeypatch.setattr(connection_probe, "DEADLINE_S", 1.0)
    monkeypatch.setattr(connection_probe, "HOSTNAME", lambda: "slow-self.example")
    monkeypatch.setattr(connection_probe, "LOCAL_ADDRESSES", lambda: set())
    probed: list[str] = []
    monkeypatch.setattr(connection_probe, "probe", lambda cand: probed.append(cand.nvr_host) or {"ok": True, "code": "ok"})
    t0 = time.monotonic()
    res = connection_probe.check_and_probe("slow-nvr.example", settings, lambda target: connection_probe.candidate(
        settings, vendor="hikvision", target=target, http_port=80, rtsp_port=554, username="u", password="p"))
    took = time.monotonic() - t0
    assert res["ok"] is False and res["code"] in ("timeout", "source_unavailable"), res
    assert probed == []
    assert took < 1.0 + 0.6, f"resolution took {took:.1f} s past a 1 s budget"
