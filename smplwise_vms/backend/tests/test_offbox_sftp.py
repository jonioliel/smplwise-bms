"""DATASTORE-295 phase 2: the SFTP transport (services/offbox_sftp.py) against a real SSH/SFTP server - paramiko's own server classes,
running in-process on 127.0.0.1 with a temporary folder as its disk. Proves: key authentication, the pinned host key (line or SHA256
fingerprint) checked before authentication (a different key is refused and no file is written), a wrong client key is `auth_failed`,
a closed port is `destination_unavailable`, a full push / verify / prune with atomic rename, and the connection test's marker.
Needs paramiko (smplwise_vms/backend/requirements.txt); skipped when the test environment lacks it."""
from __future__ import annotations

import io
import json
import logging
import os
import socket
import threading
from pathlib import Path

import pytest

paramiko = pytest.importorskip("paramiko")

from smplwise.services import backup_offbox as ob  # noqa: E402
from smplwise.services import offbox_sftp  # noqa: E402


class _Handle(paramiko.SFTPHandle):
    def stat(self):
        return paramiko.SFTPAttributes.from_stat(os.fstat(self.readfile.fileno() if hasattr(self, "readfile") else self.writefile.fileno()))


class _SFTP(paramiko.SFTPServerInterface):
    ROOT: Path = Path(".")

    def _real(self, path: str) -> Path:
        p = (self.ROOT / path.lstrip("/")).resolve()
        if self.ROOT.resolve() not in (p, *p.parents):
            raise PermissionError(path)
        return p

    def list_folder(self, path):
        try:
            out = []
            for name in os.listdir(self._real(path)):
                attr = paramiko.SFTPAttributes.from_stat(os.stat(self._real(path) / name))
                attr.filename = name
                out.append(attr)
            return out
        except OSError as e:
            return paramiko.SFTPServer.convert_errno(e.errno)

    def stat(self, path):
        try:
            return paramiko.SFTPAttributes.from_stat(os.stat(self._real(path)))
        except OSError as e:
            return paramiko.SFTPServer.convert_errno(e.errno)

    lstat = stat

    def open(self, path, flags, attr):
        real = self._real(path)
        try:
            fd = os.open(real, flags | getattr(os, "O_BINARY", 0), 0o600)
        except OSError as e:
            return paramiko.SFTPServer.convert_errno(e.errno)
        mode = "wb" if flags & os.O_WRONLY else ("r+b" if flags & os.O_RDWR else "rb")
        if flags & os.O_APPEND:
            mode = "ab"
        f = os.fdopen(fd, mode)
        h = _Handle(flags)
        h.filename = str(real)
        h.readfile = f
        h.writefile = f
        return h

    def remove(self, path):
        try:
            os.remove(self._real(path))
        except OSError as e:
            return paramiko.SFTPServer.convert_errno(e.errno)
        return paramiko.SFTP_OK

    def rename(self, oldpath, newpath):
        os.replace(self._real(oldpath), self._real(newpath))
        return paramiko.SFTP_OK

    def posix_rename(self, oldpath, newpath):
        os.replace(self._real(oldpath), self._real(newpath))
        return paramiko.SFTP_OK


class _Server(paramiko.ServerInterface):
    def __init__(self, allowed: paramiko.PKey):
        self.allowed = allowed

    def check_auth_publickey(self, username, key):
        return paramiko.AUTH_SUCCESSFUL if username == "arx" and key.asbytes() == self.allowed.asbytes() else paramiko.AUTH_FAILED

    def check_auth_password(self, username, password):
        return paramiko.AUTH_FAILED

    def get_allowed_auths(self, username):
        return "publickey"

    def check_channel_request(self, kind, chanid):
        return paramiko.OPEN_SUCCEEDED if kind == "session" else paramiko.OPEN_FAILED_ADMINISTRATIVELY_PROHIBITED


class SftpTestServer:
    def __init__(self, root: Path, client_key: paramiko.PKey, host_key: paramiko.PKey | None = None):
        self.root = root
        self.host_key = host_key or paramiko.ECDSAKey.generate()
        self.client_key = client_key
        self.sock = socket.socket()
        self.sock.bind(("127.0.0.1", 0))
        self.sock.listen(8)
        self.port = self.sock.getsockname()[1]
        self.transports: list[paramiko.Transport] = []
        self.stop = threading.Event()
        threading.Thread(target=self._serve, daemon=True).start()

    def _serve(self):
        self.sock.settimeout(0.5)
        while not self.stop.is_set():
            try:
                conn, _ = self.sock.accept()
            except (socket.timeout, OSError):
                continue
            t = paramiko.Transport(conn)
            t.add_server_key(self.host_key)
            _SFTP.ROOT = self.root
            t.set_subsystem_handler("sftp", paramiko.SFTPServer, _SFTP)
            try:
                t.start_server(server=_Server(self.client_key))
            except Exception:  # noqa: BLE001
                continue
            self.transports.append(t)

    def close(self):
        self.stop.set()
        for t in self.transports:
            t.close()
        self.sock.close()


def _key_text(k: paramiko.PKey) -> str:
    buf = io.StringIO()
    k.write_private_key(buf)
    return buf.getvalue()


@pytest.fixture()
def server(tmp_path):
    client_key = paramiko.ECDSAKey.generate()
    root = tmp_path / "sftp-root"
    (root / "backups").mkdir(parents=True)
    srv = SftpTestServer(root, client_key)
    keyfile = tmp_path / "client_key"
    keyfile.write_text(_key_text(client_key))
    srv.keyfile = keyfile
    yield srv
    srv.close()


def _dest(srv, pin: str | None = None, keyfile: Path | None = None) -> ob.SftpDestination:
    return ob.build_destination({"kind": "sftp", "host": "127.0.0.1", "port": srv.port, "username": "arx", "remote_dir": "/backups",
                                 "host_key": pin or offbox_sftp.host_key_line(srv.host_key), "key": f"file:{(keyfile or srv.keyfile).as_posix()}"})


def _archive(tmp_path: Path, name: str, size: int = 1024 * 1024 + 9) -> Path:
    p = tmp_path / "src" / name
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(os.urandom(size))
    return p


def test_push_verify_prune_over_real_sftp(server, tmp_path, caplog):
    key = ob.load_or_create_key(tmp_path / "k.key")
    policy = ob.RetentionPolicy(keep_last=1, keep_daily=0, keep_weekly=0, keep_monthly=0)
    d = _dest(server)
    with caplog.at_level(logging.DEBUG):
        r1 = ob.push(_archive(tmp_path, "auto-daily-20261019-030000.zip"), d, key, policy=policy)
        r2 = ob.push(_archive(tmp_path, "auto-daily-20261020-030000.zip"), d, key, policy=policy)
    d.close()
    assert r1["ok"] and r2["ok"] and r2["verified"], (r1, r2)
    assert r2["deleted"] == ["auto-daily-20261019-030000.zip.swxb"]
    assert sorted(p.name for p in (server.root / "backups").iterdir()) == ["auto-daily-20261020-030000.zip.swxb"], "no .partial left"
    assert "PRIVATE KEY" not in caplog.text and "PRIVATE KEY" not in json.dumps([r1, r2])


def test_fingerprint_pin_and_connection_check(server):
    pin = offbox_sftp.fingerprint(server.host_key.asbytes())
    assert pin.startswith("SHA256:") and len(pin) == 50
    d = _dest(server, pin=pin)
    r = ob.check_connection(d)
    d.close()
    assert r["ok"], r
    assert list((server.root / "backups").iterdir()) == []


def test_a_different_host_key_is_refused_before_authentication(server, tmp_path):
    other = paramiko.ECDSAKey.generate()
    d = _dest(server, pin=offbox_sftp.host_key_line(other))
    r = ob.push(_archive(tmp_path, "manual-20261020-120000.zip", size=50), d, ob.load_or_create_key(tmp_path / "k.key"))
    d.close()
    assert not r["ok"] and r["error"] == "host_key_mismatch" and not r["uploaded"]
    assert list((server.root / "backups").iterdir()) == []
    assert not offbox_sftp.host_key_matches("ssh-ed25519 AAAA", server.host_key.get_name(), server.host_key.asbytes())


def test_a_wrong_client_key_is_auth_failed(server, tmp_path):
    wrong = tmp_path / "wrong_key"
    wrong.write_text(_key_text(paramiko.ECDSAKey.generate()))
    d = _dest(server, keyfile=wrong)
    assert ob.check_connection(d)["error"] == "auth_failed"
    garbage = tmp_path / "garbage_key"
    garbage.write_text("not a key")
    assert ob.check_connection(_dest(server, keyfile=garbage))["error"] == "key_unreadable"


def test_a_closed_port_is_destination_unavailable(tmp_path):
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    kf = tmp_path / "k"
    kf.write_text(_key_text(paramiko.ECDSAKey.generate()))
    d = ob.build_destination({"kind": "sftp", "host": "127.0.0.1", "port": port, "username": "arx", "remote_dir": "/backups",
                              "host_key": "SHA256:" + "A" * 43, "key": f"file:{kf.as_posix()}"})
    assert ob.check_connection(d)["error"] == "destination_unavailable"


def test_rsa_keys_still_work_over_sha2_only(tmp_path):
    """DEPAUDIT-2310 M2 (CVE-2026-44405): paramiko 5.x dropped SHA-1 `ssh-rsa` signatures. An RSA host key (an `ssh-rsa AAAA...` pin)
    and an RSA client key still authenticate, over rsa-sha2-256 / -512."""
    assert int(paramiko.__version__.split(".")[0]) >= 5, paramiko.__version__
    client_key = paramiko.RSAKey.generate(2048)
    root = tmp_path / "sftp-root"
    (root / "backups").mkdir(parents=True)
    srv = SftpTestServer(root, client_key, host_key=paramiko.RSAKey.generate(2048))
    try:
        srv.keyfile = tmp_path / "client_key"
        srv.keyfile.write_text(_key_text(client_key))
        d = _dest(srv)
        assert offbox_sftp.host_key_line(srv.host_key).startswith("ssh-rsa ")
        client = offbox_sftp.connect(d)
        try:
            assert client._t.host_key_type in ("rsa-sha2-256", "rsa-sha2-512"), client._t.host_key_type
        finally:
            client.close()
        r = ob.check_connection(d)
        d.close()
        assert r["ok"], r
    finally:
        srv.close()
