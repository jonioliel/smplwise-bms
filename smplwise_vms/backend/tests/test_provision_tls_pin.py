"""Security review (2026-10-04): the certificate pin is checked on the SAME TLS connection that carries the request, before any
request byte (and so before the credentials); the connection test never sends credentials before a certificate is pinned.
A local TLS server with a throwaway self-signed certificate stands in for the NVR."""
from __future__ import annotations

import dataclasses
import datetime as dt
import hashlib
import socket
import ssl
import threading
from pathlib import Path

import pytest
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.x509.oid import NameOID

from smplwise.errors import ApiError
from smplwise.services.recorders import provision_isr as pisr


def _cert(tmp: Path) -> tuple[Path, Path, str]:
    key = ec.generate_private_key(ec.SECP256R1())
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "nvr-fake")])
    now = dt.datetime.now(dt.timezone.utc)
    cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key()).serial_number(1)
            .not_valid_before(now - dt.timedelta(days=1)).not_valid_after(now + dt.timedelta(days=1)).sign(key, hashes.SHA256()))
    cp, kp = tmp / "c.pem", tmp / "k.pem"
    cp.write_bytes(cert.public_bytes(serialization.Encoding.PEM))
    kp.write_bytes(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
    return cp, kp, hashlib.sha256(cert.public_bytes(serialization.Encoding.DER)).hexdigest()


@pytest.fixture()
def tls_server(tmp_path):
    cp, kp, sha = _cert(tmp_path)
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(cp, kp)
    srv = socket.socket()
    srv.bind(("127.0.0.1", 0))
    srv.listen(4)
    received: list[bytes] = []
    stop = threading.Event()

    def serve():
        srv.settimeout(0.2)
        while not stop.is_set():
            try:
                conn, _ = srv.accept()
            except OSError:
                continue
            try:
                with ctx.wrap_socket(conn, server_side=True) as tls:
                    tls.settimeout(2)
                    data = b""
                    try:
                        while b"\r\n\r\n" not in data:
                            chunk = tls.recv(4096)
                            if not chunk:
                                break
                            data += chunk
                    except OSError:
                        pass
                    received.append(data)
                    if data:
                        body = b'<?xml version="1.0"?><config xmlns="http://www.ipc.com/ver10"><diskInfo type="list" count="0"></diskInfo></config>'
                        tls.sendall(b"HTTP/1.0 200 OK\r\nContent-Type: application/xml\r\nContent-Length: " + str(len(body)).encode() + b"\r\n\r\n" + body)
            except (ssl.SSLError, OSError):
                received.append(b"")

    t = threading.Thread(target=serve, daemon=True)
    t.start()
    yield srv.getsockname()[1], sha, received
    stop.set()
    srv.close()


def _adapter(settings, port: int, pin: str) -> pisr.ProvisionIsrAdapter:
    s = dataclasses.replace(settings, nvr_host="127.0.0.1", nvr_http_port=80, nvr_user="u", nvr_password="secret-p", nvr_vendor="provision_isr",
                            nvr_extra={"scheme": "https", "https_port": port, "tls_mode": "pin", "tls_pin": pin, "auth": "basic"})
    return pisr.ProvisionIsrAdapter("nvr-2", s)


def test_matching_pin_carries_the_request(settings, tls_server):
    port, sha, received = tls_server
    pisr.clear_auth_cache()
    assert _adapter(settings, port, sha).storage() == []
    assert any(b"Authorization: Basic" in r for r in received)


def test_wrong_pin_closes_before_any_request_byte(settings, tls_server):
    port, sha, received = tls_server
    pisr.clear_auth_cache()
    with pytest.raises(ApiError) as e:
        _adapter(settings, port, "0" * 64).storage()
    assert e.value.code == "tls_pin_mismatch"
    assert all(b"Authorization" not in r and b"POST" not in r for r in received), "no request byte, no credential was sent"


def test_pin_context_rejects_on_the_same_connection(tls_server):
    port, sha, _ = tls_server
    raw = socket.create_connection(("127.0.0.1", port), timeout=3)
    with pytest.raises(ssl.SSLError):
        pisr.pinned_context("f" * 64).wrap_socket(raw, server_hostname="127.0.0.1")
    ok = pisr.pinned_context(sha).wrap_socket(socket.create_connection(("127.0.0.1", port), timeout=3), server_hostname="127.0.0.1")
    ok.close()


def test_probe_sends_no_credentials_before_a_pin(settings, monkeypatch):
    """Pin chosen, nothing pinned yet: the probe returns the certificate and `tls_pin_required`, and sends no HTTP request."""
    import sys

    from smplwise.services import connection_probe

    sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
    from fake_provision import FakeProvision, settings_for

    fake = FakeProvision()
    monkeypatch.setattr(connection_probe, "TRANSPORT", fake.transport())
    monkeypatch.setattr(pisr, "PEER_CERTIFICATE", lambda host, port, timeout: {"sha256": "ab" * 32, "self_signed": True})
    cand = settings_for(settings, scheme="https", https_port=443, tls_mode="pin")
    out = connection_probe._probe_vendor(cand, 5.0, [])
    assert out["ok"] is False and out["code"] == "tls_pin_required" and out["certificate"]["sha256"] == "ab" * 32
    assert fake.hits == [], "no request (and so no credential) before the certificate is pinned"
