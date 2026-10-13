"""CR-038 section 7.4: the module key `k_tickets`.

32 random bytes in `<data>/secrets/tickets_key`, mode 0600 in a 0700 folder. Never in the database, never in a project backup
(the file is outside every PROJECT_TABLES / RESTORABLE_ROOTS entry), never in an API answer, an audit row or a log line. It
derives the handler-link tokens (links.derive_token), keys the verification codes (codes.code_hash), the phone-number match
index (links.phone_key) and the per-device access keys (links.client_key). Created when the module is first enabled
(`load(create=True)`); `rotate` replaces it, after which every derived token is dead - the caller (slice 4) revokes every link
with reason `module_key` and recomputes `phone_key` for all contacts in the same transaction.

Residual, stated in the spec (review T20): the Home Assistant add-on backup holds all of /data, this file included; whoever
holds such a backup can derive every live token.

The file is written the alarm-code-key way (services/alarm_codes._load_or_create_key): a fresh temporary file (0600, binary),
flushed to disk, then renamed into place, so a crash never leaves a half-written key; a file of the wrong length is refused
rather than silently replaced (the links of the installation depend on it)."""
from __future__ import annotations

import os
import secrets
import threading
from pathlib import Path

KEY_BYTES = 32
FILE_NAME = "tickets_key"
_lock = threading.Lock()


class ModuleKeyError(Exception):
    """The module key is missing or damaged. The message is fixed text - never key material."""


def key_path(data_dir: Path) -> Path:
    return Path(data_dir) / "secrets" / FILE_NAME


def _write(p: Path, key: bytes) -> None:
    d = p.parent
    d.mkdir(parents=True, exist_ok=True)
    try:
        os.chmod(d, 0o700)
    except OSError:
        pass
    tmp = p.with_name(f".{FILE_NAME}.{secrets.token_hex(4)}.tmp")
    fd = os.open(str(tmp), os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_BINARY", 0), 0o600)
    try:
        os.write(fd, key)
        os.fsync(fd)
    finally:
        os.close(fd)
    try:
        os.replace(tmp, p)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def load(data_dir: Path, *, create: bool) -> bytes | None:
    """The key, or None when there is none and `create` is False. A file of another length raises ModuleKeyError."""
    p = key_path(data_dir)
    with _lock:
        if p.exists():
            raw = p.read_bytes()
            if len(raw) != KEY_BYTES:
                raise ModuleKeyError("the tickets module key file is damaged")
            return raw
        if not create:
            return None
        key = secrets.token_bytes(KEY_BYTES)
        _write(p, key)
        return key


def rotate(data_dir: Path) -> bytes:
    """Write a new key in place of the current one (or the first one) and return it."""
    p = key_path(data_dir)
    with _lock:
        key = secrets.token_bytes(KEY_BYTES)
        _write(p, key)
        return key


class ModuleKey:
    """The key of one installation, read once and kept in memory. `get()` raises ModuleKeyError while there is no key (the
    module was never enabled): nothing that needs the key - a token release, a code hash - can then succeed, which is the
    intended fail-closed answer. `rotate()` replaces it; `reload()` forgets the cached copy (a restore of /data)."""

    def __init__(self, data_dir: Path) -> None:
        self._data_dir = Path(data_dir)
        self._key: bytes | None = None
        self._lock = threading.Lock()

    def get(self, *, create: bool = False) -> bytes:
        with self._lock:
            if self._key is None:
                self._key = load(self._data_dir, create=create)
            if self._key is None:
                raise ModuleKeyError("the tickets module key does not exist yet")
            return self._key

    def __call__(self) -> bytes:
        return self.get()

    def rotate(self) -> bytes:
        with self._lock:
            self._key = rotate(self._data_dir)
            return self._key

    def reload(self) -> None:
        with self._lock:
            self._key = None

    def __repr__(self) -> str:  # never the key bytes
        return f"ModuleKey(loaded={self._key is not None})"
