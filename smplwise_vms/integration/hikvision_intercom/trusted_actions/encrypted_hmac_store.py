"""Explicit owner-provisioned AES-GCM HMAC persistence; dormant until composed.

No operational secret is generated or discovered. The wrapping key is supplied
by trusted provisioning (or explicitly loaded from an existing macOS Keychain
item); it is never persisted beside the ciphertext or returned in a receipt.
"""

from __future__ import annotations

import asyncio
import base64
import fcntl
import hashlib
import json
import os
import stat
import subprocess
import threading
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from .hmac_rotation import HmacRotation, HmacSecret, RotationState
from .lifetime import shielded_commit
from .source_bindings import same_ports
from .validation import Refusal, reference

FORMAT = "wiskey-encrypted-hmac.v1"
MAX_BYTES = 4096
FILE = "hmac-state.aesgcm"
LOCK = "hmac-state.lock"


def _json(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()


def _pairs(items):
    result = {}
    for key, value in items:
        if key in result:
            raise ValueError
        result[key] = value
    return result


@dataclass(frozen=True, repr=False)
class WrappingKey:
    key_ref: str
    key: bytes

    def __post_init__(self):
        reference(self.key_ref)
        if type(self.key) is not bytes or len(self.key) != 32:
            raise Refusal("invalid_fields")


async def mac_keychain_wrapping_key(*, service: str, account: str, key_ref: str) -> WrappingKey:
    """Read one explicitly named existing item; never add/update a Keychain item.

    Its value must be strict base64 of a 32-byte owner-provisioned wrapping key.
    Startup and product routes do not call this function; tests replace the subprocess.
    """
    for value in (service, account, key_ref):
        reference(value)

    def read():
        try:
            result = subprocess.run(
                ["/usr/bin/security", "find-generic-password", "-s", service, "-a", account, "-w"],
                stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
                timeout=5,
                check=True,
            )
            value = result.stdout
            if type(value) is not bytes or len(value) > 128:
                raise ValueError
            return WrappingKey(key_ref, base64.b64decode(value.strip(), validate=True))
        except Exception:
            raise Refusal("Unauthorized") from None

    # A cancelled owner still joins the original bounded Keychain subprocess.
    return await shielded_commit(lambda: asyncio.to_thread(read), lambda: None)


def _secret(value):
    if type(value) is not dict or set(value) != {"key_ref", "revision", "key"}:
        raise ValueError
    return HmacSecret(
        value["key_ref"], value["revision"], base64.b64decode(value["key"], validate=True)
    )


def _state(value):
    if type(value) is not dict or set(value) != {
        "revision",
        "current",
        "retiring",
        "retiring_until",
        "changed_at",
    }:
        raise ValueError
    return RotationState(
        value["revision"],
        _secret(value["current"]),
        None if value["retiring"] is None else _secret(value["retiring"]),
        None
        if value["retiring_until"] is None
        else datetime.fromisoformat(value["retiring_until"]),
        datetime.fromisoformat(value["changed_at"]),
    )


def _state_bytes(value):
    if type(value) is not RotationState:
        raise Refusal("invalid_fields")

    def secret(item):
        return {
            "key_ref": item.key_ref,
            "revision": item.revision,
            "key": base64.b64encode(item.key).decode(),
        }

    return _json(
        {
            "revision": value.revision,
            "current": secret(value.current),
            "retiring": None if value.retiring is None else secret(value.retiring),
            "retiring_until": None
            if value.retiring_until is None
            else value.retiring_until.isoformat(),
            "changed_at": value.changed_at.isoformat(),
        }
    )


class EncryptedHmacStore:
    """Private dedicated directory, original owner guard and compare-before-save.

    There is no automatic migration, key fallback, missing-file reset or retry.
    Filesystem administration and the wrapping-key provider are trusted. This
    cannot detect rollback of an entire old filesystem snapshot across restart.
    """

    def __init__(self, root: str | Path, *, repository_id: str, wrapping_key: WrappingKey, current):
        self.repository_id = reference(repository_id)
        if type(wrapping_key) is not WrappingKey or not callable(current):
            raise Refusal("invalid_fields")
        self.root = Path(root).absolute()
        self.wrapping_key, self.current = wrapping_key, current
        self.closed = False
        self._fd = None
        self._expected = None
        self._loaded = False
        self._io_lock = threading.RLock()
        self._head = None
        self._state_digest = None
        self._async_lock = asyncio.Lock()
        self._ports = (current,)
        self._configuration = self.root, repository_id, wrapping_key
        try:
            if not self.root.exists():
                self.root.mkdir(mode=0o700)
            self._fd = os.open(self.root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
            self._identity = os.fstat(self._fd)
            self._check()
        except Exception:
            if self._fd is not None:
                os.close(self._fd)
            self.closed = True
            raise Refusal("storage_write_failed") from None

    def _check(self):
        try:
            self._check_inner()
        except Refusal:
            raise
        except Exception:
            raise Refusal("Unauthorized") from None

    def _check_inner(self):
        def stable():
            if (
                self.closed
                or self._fd is None
                or not same_ports(self._ports, (self.current,))
                or self.root != self._configuration[0]
                or self.repository_id != self._configuration[1]
                or self.wrapping_key is not self._configuration[2]
            ):
                raise Refusal("Unauthorized")
            original, path = os.fstat(self._fd), os.stat(self.root, follow_symlinks=False)
            if (
                not stat.S_ISDIR(path.st_mode)
                or path.st_uid != os.geteuid()
                or stat.S_IMODE(path.st_mode) != 0o700
                or (original.st_dev, original.st_ino) != (path.st_dev, path.st_ino)
                or (path.st_dev, path.st_ino) != (self._identity.st_dev, self._identity.st_ino)
            ):
                raise Refusal("Unauthorized")

        # The original callback is allowed to revoke, never to replace a
        # resource/configuration during the final check and have it adopted.
        stable()
        if self.current() is not True:
            raise Refusal("Unauthorized")
        stable()
        if self.current() is not True:
            raise Refusal("Unauthorized")
        stable()

    def _open(self, name, *, create=False):
        fd = os.open(
            name, os.O_RDWR | os.O_NOFOLLOW | (os.O_CREAT if create else 0), 0o600, dir_fd=self._fd
        )
        metadata = os.fstat(fd)
        if (
            not stat.S_ISREG(metadata.st_mode)
            or metadata.st_uid != os.geteuid()
            or stat.S_IMODE(metadata.st_mode) != 0o600
            or metadata.st_nlink != 1
            or metadata.st_size > MAX_BYTES
        ):
            os.close(fd)
            raise Refusal("invalid_storage")
        return fd

    @staticmethod
    def _head_of(value):
        return value.st_dev, value.st_ino, value.st_size, value.st_mtime_ns, value.st_ctime_ns

    def _read_snapshot(self):
        try:
            fd = self._open(FILE)
        except FileNotFoundError:
            return None, None
        with os.fdopen(fd, "rb") as source:
            head = self._head_of(os.fstat(source.fileno()))
            value = source.read(MAX_BYTES + 1)
            unchanged = head == self._head_of(os.fstat(source.fileno()))
        if len(value) > MAX_BYTES or not unchanged or self._file_head() != head:
            raise Refusal("invalid_storage")
        return value, head

    def _read(self):
        return self._read_snapshot()[0]

    def _decode(self, value):
        try:
            body = json.loads(value, object_pairs_hook=_pairs)
            if (
                type(body) is not dict
                or set(body) != {"format", "repository_id", "key_ref", "nonce", "ciphertext"}
                or body["format"] != FORMAT
                or body["repository_id"] != self.repository_id
                or body["key_ref"] != self.wrapping_key.key_ref
                or _json(body) != value
            ):
                raise ValueError
            nonce = base64.b64decode(body["nonce"], validate=True)
            if len(nonce) != 12:
                raise ValueError
            plain = AESGCM(self.wrapping_key.key).decrypt(
                nonce, base64.b64decode(body["ciphertext"], validate=True), self._aad()
            )
            state = _state(json.loads(plain, object_pairs_hook=_pairs))
            if _state_bytes(state) != plain:
                raise ValueError
            return state
        except Exception:
            raise Refusal("invalid_storage") from None

    def _aad(self):
        return _json(
            {
                "format": FORMAT,
                "repository_id": self.repository_id,
                "key_ref": self.wrapping_key.key_ref,
            }
        )

    def _load(self) -> RotationState:
        self._check()
        value, head = self._read_snapshot()
        if value is None:
            raise Refusal("invalid_storage")
        state = self._decode(value)
        self._check()
        if self._file_head() != head:
            raise Refusal("revision_conflict")
        self._expected = hashlib.sha256(value).digest()
        self._state_digest = hashlib.sha256(_state_bytes(state)).digest()
        self._head = head
        self._loaded = True
        return state

    def load(self) -> RotationState:
        with self._io_lock:
            return self._load()

    def _file_head(self):
        value = os.stat(FILE, dir_fd=self._fd, follow_symlinks=False)
        if (
            not stat.S_ISREG(value.st_mode)
            or value.st_uid != os.geteuid()
            or stat.S_IMODE(value.st_mode) != 0o600
            or value.st_nlink != 1
        ):
            raise Refusal("invalid_storage")
        return self._head_of(value)

    def _save_inner(self, state, *, initial=False):
        self._check()
        lock = self._open(LOCK, create=True)
        temporary = None
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            self._check()
            old = self._read()
            if initial:
                if old is not None or self._loaded:
                    raise Refusal("revision_conflict")
            elif not self._loaded or old is None or hashlib.sha256(old).digest() != self._expected:
                raise Refusal("revision_conflict")
            if old is not None:
                previous = self._decode(old)
                rotating = (
                    state.revision == previous.revision + 1
                    and state.retiring == previous.current
                    and state.current.key_ref != previous.current.key_ref
                    and state.current.key != previous.current.key
                    and (
                        previous.retiring is None
                        or (
                            state.current.key_ref != previous.retiring.key_ref
                            and state.current.key != previous.retiring.key
                        )
                    )
                )
                revoking = (
                    state.revision == previous.revision
                    and state.current == previous.current
                    and state.retiring is None
                )
                if state.changed_at < previous.changed_at or not (rotating or revoking):
                    raise Refusal("revision_conflict")
            plain, nonce = _state_bytes(state), os.urandom(12)
            body = json.loads(self._aad())
            body.update(
                nonce=base64.b64encode(nonce).decode(),
                ciphertext=base64.b64encode(
                    AESGCM(self.wrapping_key.key).encrypt(nonce, plain, self._aad())
                ).decode(),
            )
            encoded = _json(body)
            if len(encoded) > MAX_BYTES:
                raise Refusal("invalid_fields")
            temporary = ".hmac-" + os.urandom(16).hex()
            fd = os.open(
                temporary,
                os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
                0o600,
                dir_fd=self._fd,
            )
            with os.fdopen(fd, "wb") as target:
                target.write(encoded)
                target.flush()
                os.fsync(target.fileno())
            self._check()
            os.replace(temporary, FILE, src_dir_fd=self._fd, dst_dir_fd=self._fd)
            temporary = None
            os.fsync(self._fd)
            self._check()
            saved, head = self._read_snapshot()
            if saved != encoded:
                raise Refusal("revision_conflict")
            self._expected = hashlib.sha256(encoded).digest()
            self._state_digest = hashlib.sha256(plain).digest()
            self._head = head
            self._loaded = True
        except Refusal:
            raise
        except Exception:
            raise Refusal("storage_write_failed") from None
        finally:
            if temporary is not None:
                os.unlink(temporary, dir_fd=self._fd)
            os.close(lock)

    def _save(self, state, *, initial=False):
        if type(state) is not RotationState:
            raise Refusal("invalid_fields")
        with self._io_lock:
            self._save_inner(state, initial=initial)

    async def provision(self, state: RotationState):
        """Explicit first provisioning only; never generates a key or resets state."""
        async with self._async_lock:
            await shielded_commit(
                lambda: asyncio.to_thread(self._save, state, initial=True), lambda: None
            )

    async def persist(self, state: RotationState):
        async with self._async_lock:
            await shielded_commit(lambda: asyncio.to_thread(self._save, state), lambda: None)

    def ring(self, *, clock) -> HmacRotation:
        """Load the original durable state and bind its actual encrypted save port."""
        state = self.load()
        owner = []

        def current_clock():
            acquired = False
            try:
                # Authentication runs on HA's event loop. Refuse while the
                # original worker saves; never block that loop on file I/O.
                acquired = self._io_lock.acquire(blocking=False)
                if not acquired:
                    raise Refusal("Unauthorized")

                def current():
                    self._check()
                    if (
                        not owner
                        or self._file_head() != self._head
                        or hashlib.sha256(_state_bytes(owner[0]._state)).digest()
                        != self._state_digest
                    ):
                        raise Refusal("Unauthorized")

                current()
                sample = clock()
                current()
                return sample
            except Exception:
                raise Refusal("Unauthorized") from None
            finally:
                if acquired:
                    self._io_lock.release()

        ring = HmacRotation(state, persist=self.persist, clock=current_clock)
        owner.append(ring)
        return ring

    def close(self):
        if not self._io_lock.acquire(blocking=False):
            raise Refusal("storage_busy")
        try:
            if not self.closed:
                self.closed = True
                os.close(self._fd)
        finally:
            self._io_lock.release()

    async def async_close(self):
        def closing():
            with self._io_lock:
                self.close()

        await shielded_commit(lambda: asyncio.to_thread(closing), lambda: None)
