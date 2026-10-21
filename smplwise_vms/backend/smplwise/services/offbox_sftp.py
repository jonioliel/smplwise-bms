"""DATASTORE-295 phase 2: the SFTP transport of the off-box copies (services/backup_offbox.SftpDestination), on paramiko.

Rules:
- the server's host key is PINNED in the target's configuration (`ssh-ed25519 AAAA...` / `ecdsa-sha2-nistp256 ...` / `ssh-rsa ...`, or
  its OpenSSH `SHA256:` fingerprint). The key the server presents is compared BEFORE any authentication; a different key is
  `host_key_mismatch` and the connection is closed - no trust on first use, no known_hosts file written;
- key authentication only (an OpenSSH / PEM private key from the target's secret reference); never a password, no agent, no
  ~/.ssh lookups;
- the private key text lives only inside `connect()`; nothing here logs a key, a fingerprint of the client key or a server banner.

`host_key_line(key)` / `fingerprint(key)` help the settings screen show what to pin (the administrator copies the line from the server:
`ssh-keyscan -t ed25519 <host>` or `/etc/ssh/ssh_host_ed25519_key.pub`). Tests: tests/test_offbox_sftp.py runs a paramiko SFTP server
on 127.0.0.1 in-process."""
from __future__ import annotations

import base64
import hashlib
import hmac
import io
import logging
import socket
from typing import Any

from .backup_offbox import OffboxError

log = logging.getLogger("smplwise.backup.offbox")


def fingerprint(key_blob: bytes) -> str:
    """OpenSSH `SHA256:` fingerprint of a public key blob (base64 without padding)."""
    return "SHA256:" + base64.b64encode(hashlib.sha256(key_blob).digest()).decode().rstrip("=")


def host_key_line(key: Any) -> str:
    return f"{key.get_name()} {key.get_base64()}"


def host_key_matches(pinned: str, key_type: str, key_blob: bytes) -> bool:
    pinned = (pinned or "").strip()
    if pinned.startswith("SHA256:"):
        return hmac.compare_digest(pinned.rstrip("="), fingerprint(key_blob))
    parts = pinned.split()
    if len(parts) < 2:
        return False
    try:
        blob = base64.b64decode(parts[1], validate=True)
    except ValueError:
        return False
    return parts[0] == key_type and hmac.compare_digest(blob, key_blob)


def _load_private_key(text: str) -> Any:
    import paramiko

    for cls in (paramiko.Ed25519Key, paramiko.ECDSAKey, paramiko.RSAKey):
        try:
            return cls.from_private_key(io.StringIO(text))
        except (paramiko.SSHException, ValueError, TypeError):
            continue
    raise OffboxError("key_unreadable", "the private key is not an unencrypted OpenSSH / PEM key (ed25519, ecdsa or rsa)")


class _Client:
    """The SFTP client plus its transport, closed together."""

    def __init__(self, transport: Any, sftp: Any):
        self._t, self._s = transport, sftp

    def put(self, localpath: str, remotepath: str) -> Any:
        return self._call(self._s.put, localpath, remotepath)

    def get(self, remotepath: str, localpath: str) -> Any:
        return self._call(self._s.get, remotepath, localpath)

    def listdir_attr(self, path: str) -> list[Any]:
        return self._call(self._s.listdir_attr, path)

    def remove(self, path: str) -> Any:
        return self._call(self._s.remove, path)

    def posix_rename(self, oldpath: str, newpath: str) -> Any:
        return self._call(self._s.posix_rename, oldpath, newpath)

    def close(self) -> None:
        try:
            self._s.close()
        finally:
            self._t.close()

    @staticmethod
    def _call(fn: Any, *args: Any) -> Any:
        try:
            return fn(*args)
        except FileNotFoundError:
            raise OffboxError("object_missing", "the remote file or folder does not exist") from None
        except PermissionError:
            raise OffboxError("permission_denied", "the SFTP account may not write there") from None
        except OSError as exc:
            raise OffboxError("destination_unavailable", f"SFTP error ({type(exc).__name__})") from None
        except EOFError:
            raise OffboxError("destination_unavailable", "the SFTP connection was closed") from None


def connect(dest: Any, *, sock: socket.socket | None = None) -> _Client:
    """Open the SFTP session of an SftpDestination: TCP, SSH handshake, host key check against the pin, key authentication."""
    try:
        import paramiko
    except ImportError:
        raise OffboxError("transport_not_available", "the SFTP library is not installed in this build") from None
    try:
        sock = sock or socket.create_connection((dest.host, dest.port), timeout=dest.timeout_s)
    except OSError:
        raise OffboxError("destination_unavailable", "the SFTP server did not answer") from None
    transport = paramiko.Transport(sock)
    try:
        transport.banner_timeout = dest.timeout_s
        transport.auth_timeout = dest.timeout_s
        try:
            transport.start_client(timeout=dest.timeout_s)
        except (paramiko.SSHException, EOFError, OSError):
            raise OffboxError("destination_unavailable", "the SSH handshake failed") from None
        server_key = transport.get_remote_server_key()
        if not host_key_matches(dest.host_key, server_key.get_name(), server_key.asbytes()):
            log.warning("off-box SFTP: the server %s presented a host key that is not the pinned one", dest.host)
            raise OffboxError("host_key_mismatch", "the server's host key is not the pinned one")
        pkey = _load_private_key(dest.private_key_text())
        try:
            transport.auth_publickey(dest.username, pkey)
        except paramiko.AuthenticationException:
            raise OffboxError("auth_failed", "the SFTP server refused the key") from None
        except (paramiko.SSHException, EOFError, OSError):
            raise OffboxError("destination_unavailable", "the SFTP authentication did not complete") from None
        if not transport.is_authenticated():
            raise OffboxError("auth_failed", "the SFTP server refused the key")
        sftp = paramiko.SFTPClient.from_transport(transport)
        if sftp is None:
            raise OffboxError("destination_unavailable", "the server has no SFTP subsystem")
        sftp.get_channel().settimeout(dest.timeout_s * 6)
        return _Client(transport, sftp)
    except BaseException:
        transport.close()
        raise
