"""CR-038 section 7.4: the module key `k_tickets` - with key ids (code review V4 / W12, 2026-10-13).

Layout under `<data>/secrets/` (a 0700 folder):
- `tickets_key.<id>` - 32 random bytes each, mode 0600; `<id>` is 12 lowercase hex characters;
- `tickets_key.current` - the id of the key new derivations use.
Never in the database, never in a project backup (outside every PROJECT_TABLES / RESTORABLE_ROOTS entry; wiring item: also a
never-restored name in backup.py), never in an API answer, an audit row or a log line. It derives the handler-link tokens
(links.derive_token), keys the verification codes (codes.code_hash / derive_code), the phone-number match index
(links.phone_key) and the per-device access keys (links.client_key).

Why ids. A file change and a database transaction can never be one unit, so without ids a crash (or a failed transaction)
between "new key file" and "rows re-derived" leaves rows under one key and the file under another - every live link dead and,
worse, every `phone_key` silently unmatched (each inbound WhatsApp reply becomes an unknown sender). With ids nothing has to
be atomic across the two:
- every row that depends on the key names its key (`ticket_links.key_id`, `ticket_contacts.phone_key_id`), every
  verification uses the named key, and inbound matching computes the phone key under EACH id present (`ids()`, at most two
  during a rotation);
- rotation = `stage()` (a new key file beside the current one, unused) -> ONE database transaction that revokes the live links
  (reason `module_key`) and re-derives every `phone_key` + `phone_key_id` under the staged id -> `commit(id)` (the pointer
  moves; new links use it) -> `retire(old)` only once no row names the old id. A crash at any point leaves every row naming a
  key file that exists; a crash after the transaction but before `commit` only means new links keep using the old key until
  the rotation is resumed - both keys are present, so nothing breaks;
- creation: `current(create=True)` mints the FIRST key only when there is no pointer AND the store reports that no row depends
  on a key (`has_links`: any `ticket_links` row or any contact with a `phone_key`). A /data restored without secrets/ is
  refused with ModuleKeyError ("restore secrets/") instead of silently minting a key that kills every link. Without a
  `has_links` check the class never creates a key at all (fail closed: the caller cannot forget the check).
`status()` reports the state for the health page (absent / ok / missing / orphaned / damaged); slice 4 logs an ERROR and sets a
health flag when links exist and the state is not `ok` (W12).

Residual, stated in the spec (review T20): the Home Assistant add-on backup holds all of /data, these files included; whoever
holds such a backup can derive every live token.

Files are written the alarm-code-key way (services/alarm_codes._load_or_create_key): a fresh temporary file (0600, binary,
O_EXCL), flushed to disk, renamed into place, the directory fsynced (POSIX), so a crash never leaves a half-written key; a key
file of the wrong length is refused rather than replaced (rows depend on it)."""
from __future__ import annotations

import os
import re
import secrets
import threading
from pathlib import Path
from typing import Callable

KEY_BYTES = 32
FILE_PREFIX = "tickets_key."
POINTER_NAME = "tickets_key.current"
_ID_RE = re.compile(r"[0-9a-f]{12}")
_lock = threading.Lock()  # one writer at a time in this process (all instances share the files)


class ModuleKeyError(Exception):
    """The module key is missing, damaged or may not be created. The message is fixed text - never key material."""


def secrets_dir(data_dir: Path) -> Path:
    return Path(data_dir) / "secrets"


def is_key_id(value: object) -> bool:
    return isinstance(value, str) and bool(_ID_RE.fullmatch(value))


def key_path(data_dir: Path, key_id: str) -> Path:
    if not is_key_id(key_id):
        raise ModuleKeyError("not a tickets key id")
    return secrets_dir(data_dir) / f"{FILE_PREFIX}{key_id}"


def pointer_path(data_dir: Path) -> Path:
    return secrets_dir(data_dir) / POINTER_NAME


def new_key_id() -> str:
    return secrets.token_hex(6)


def _write(p: Path, data: bytes) -> None:
    d = p.parent
    d.mkdir(parents=True, exist_ok=True)
    try:
        os.chmod(d, 0o700)
    except OSError:
        pass
    tmp = p.with_name(f".{p.name}.{secrets.token_hex(4)}.tmp")
    fd = os.open(str(tmp), os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_BINARY", 0), 0o600)
    try:
        os.write(fd, data)
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
    _fsync_dir(d)


def _fsync_dir(d: Path) -> None:
    """Make a rename or an unlink durable (POSIX): without it a power cut can lose the directory entry. Windows has none."""
    if os.name == "nt":
        return
    try:
        fd = os.open(str(d), os.O_RDONLY)
    except OSError:
        return
    try:
        os.fsync(fd)
    except OSError:
        pass
    finally:
        os.close(fd)


def _read_key(data_dir: Path, key_id: str) -> bytes | None:
    p = key_path(data_dir, key_id)
    try:
        raw = p.read_bytes()
    except FileNotFoundError:
        return None
    if len(raw) != KEY_BYTES:
        raise ModuleKeyError("a tickets module key file is damaged")
    return raw


def _read_pointer(data_dir: Path) -> str | None:
    try:
        raw = pointer_path(data_dir).read_bytes()
    except FileNotFoundError:
        return None
    try:
        value = raw.decode("ascii").strip()
    except UnicodeDecodeError:
        value = ""
    if not is_key_id(value):
        raise ModuleKeyError("the tickets module key pointer is damaged")
    return value


def list_ids(data_dir: Path) -> tuple[str, ...]:
    """The ids of the key files present (sorted)."""
    d = secrets_dir(data_dir)
    try:
        names = [p.name for p in d.iterdir()]
    except FileNotFoundError:
        return ()
    return tuple(sorted(n[len(FILE_PREFIX):] for n in names if n.startswith(FILE_PREFIX) and is_key_id(n[len(FILE_PREFIX):])))


class ModuleKey:
    """The keys of one installation, read lazily and kept in memory. `get()` / `current()` raise ModuleKeyError while there
    is no key (the module was never enabled, or a restore lost secrets/): nothing that needs the key - a token release, a code
    hash - can then succeed, which is the intended fail-closed answer. See the module docstring for rotation and creation."""

    def __init__(self, data_dir: Path, *, has_links: Callable[[], bool] | None = None) -> None:
        self._data_dir = Path(data_dir)
        self._has_links = has_links
        self._keys: dict[str, bytes] = {}
        self._current: str | None = None
        self._lock = threading.Lock()

    # ---------------------------------------------------------------- reading

    def _load(self, key_id: str) -> bytes:
        key = self._keys.get(key_id)
        if key is None:
            key = _read_key(self._data_dir, key_id)
            if key is None:
                raise ModuleKeyError("a tickets module key named by a row is missing")
            self._keys[key_id] = key
        return key

    def current(self, *, create: bool = False) -> tuple[str, bytes]:
        """(id, key) of the key new derivations use. `create=True` mints the first key - only under the rule of the module
        docstring (no pointer, a `has_links` check that reports no dependent row)."""
        with self._lock:
            if self._current is None:
                with _lock:
                    pointer = _read_pointer(self._data_dir)
                    if pointer is None:
                        if not create:
                            raise ModuleKeyError("the tickets module key does not exist yet")
                        pointer = self._create_first()
                self._current = pointer
            return self._current, self._load(self._current)

    def _create_first(self) -> str:
        """Under both locks, no pointer present."""
        if self._has_links is None:
            raise ModuleKeyError("refusing to create a tickets module key without a check for existing links")
        try:
            in_use = bool(self._has_links())
        except Exception:  # noqa: BLE001 - an unanswered check is a refusal, never a new key
            raise ModuleKeyError("could not check for existing links; no tickets module key was created") from None
        if in_use:
            raise ModuleKeyError("links exist but the tickets module key is missing - restore secrets/ instead")
        # nothing depends on any key: a leftover file of an interrupted first creation (key written, pointer not) is unused
        # and stays where it is (status() reports it; retire() removes it)
        key_id = new_key_id()
        key = secrets.token_bytes(KEY_BYTES)
        _write(key_path(self._data_dir, key_id), key)
        _write(pointer_path(self._data_dir), key_id.encode("ascii"))
        self._keys[key_id] = key
        return key_id

    def get(self, key_id: str | None = None) -> bytes:
        """The key `key_id` (a row's `key_id`), or the current key when None."""
        if key_id is None:
            return self.current()[1]
        if not is_key_id(key_id):
            raise ModuleKeyError("not a tickets key id")
        with self._lock:
            return self._load(key_id)

    def __call__(self, key_id: str | None = None) -> bytes:
        return self.get(key_id)

    def current_id(self) -> str:
        return self.current()[0]

    def ids(self) -> tuple[str, ...]:
        """Every key id present (inbound phone matching computes the phone key under each)."""
        return list_ids(self._data_dir)

    # ---------------------------------------------------------------- rotation

    def stage(self) -> str:
        """Write a new key beside the current one and return its id; nothing uses it until `commit`."""
        self.current()  # rotation needs an installation that has a key
        with self._lock, _lock:
            key_id = new_key_id()
            key = secrets.token_bytes(KEY_BYTES)
            _write(key_path(self._data_dir, key_id), key)
            self._keys[key_id] = key
            return key_id

    def commit(self, key_id: str) -> None:
        """Make `key_id` (a staged key, its rows already re-derived) the current key."""
        with self._lock, _lock:
            self._load(key_id)  # present and well-formed, or ModuleKeyError
            _write(pointer_path(self._data_dir), key_id.encode("ascii"))
            self._current = key_id

    def retire(self, key_id: str) -> bool:
        """Delete a key file no row names any more (the caller checks the rows). Never the current key. True when a file went."""
        with self._lock, _lock:
            current = self._current or _read_pointer(self._data_dir)
            if key_id == current:
                raise ModuleKeyError("the current tickets module key cannot be retired")
            p = key_path(self._data_dir, key_id)
            self._keys.pop(key_id, None)
            try:
                p.unlink()
            except FileNotFoundError:
                return False
            _fsync_dir(p.parent)
            return True

    def reload(self) -> None:
        """Forget the cached keys and pointer (a restore of /data)."""
        with self._lock:
            self._keys.clear()
            self._current = None

    # ---------------------------------------------------------------- health

    def status(self) -> dict[str, object]:
        """`state`: absent (never enabled) | ok | missing (the pointer names no file) | orphaned (key files, no pointer) |
        damaged (a bad pointer or key file). Never key material."""
        ids = self.ids()
        try:
            pointer = _read_pointer(self._data_dir)
            if pointer is None:
                state = "orphaned" if ids else "absent"
            else:
                state = "ok" if _read_key(self._data_dir, pointer) is not None else "missing"
        except ModuleKeyError:
            pointer, state = None, "damaged"
        return {"state": state, "current": pointer, "keys": len(ids)}

    def __repr__(self) -> str:  # never key material
        return f"ModuleKey(current={self._current!r}, loaded={len(self._keys)})"
