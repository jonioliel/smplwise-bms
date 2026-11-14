"""CR-SECRET-FILES-2438 (code review 2026-11-13, 04:F09): one write sequence for every secret file on disk.

Before this module six writers carried their own copy of the sequence, and two were weaker than the rest: the fleet state
used a fixed `.tmp` name opened with `O_TRUNC`, and the evidence keyring was written in place with `write_text` (no
temporary file, no flush), so a crash in the middle of `signing._save_keyring` left a damaged keyring, which the next export
answers by starting a new signing identity. Every writer now goes through the same steps:

1. the parent directory exists and is mode 0700 (best effort);
2. the bytes go to a fresh temporary file next to the target - a random name opened with `O_CREAT | O_EXCL` (never follows
   or reuses a planted or stale file), binary (`O_BINARY` on Windows: a text-mode descriptor once turned a 0x0A key byte into
   CR LF), mode 0600 unless the caller keeps a public file's old mode;
3. the temporary file is written in full and flushed to disk (`fsync`) before it takes the target's name;
4. it takes the name atomically: `os.replace` for a file that is rewritten (`write_private`), a hard link for a key that is
   created once (`create_private`: never overwrites a key another process placed a moment earlier - the caller gets that
   key instead);
5. the directory entry is flushed (POSIX, best effort), and the temporary file never outlives the call, success or not.

An interrupted write therefore leaves either the old file or the new one, never a mix, and never a stray temporary file.
Paths, modes and contents are those each caller wrote before.
"""
from __future__ import annotations

import os
import secrets
import threading
from pathlib import Path
from typing import Callable

_POSIX = os.name == "posix"
_BINARY = getattr(os, "O_BINARY", 0)


def private_dir(d: Path) -> Path:
    """Create `d` (and its parents) and set it to 0700; best effort on the mode."""
    d.mkdir(parents=True, exist_ok=True)
    try:
        os.chmod(d, 0o700)
    except OSError:
        pass
    return d


def tighten(p: Path) -> None:
    """Review F13 (connection key, now every key): a key file is readable by its owner only - a looser mode found on disk
    (a copy, a restore by hand) is put back to 0600. POSIX only; best effort, never raises."""
    if not _POSIX:
        return
    try:
        if os.stat(p).st_mode & 0o077:
            os.chmod(p, 0o600)
    except OSError:
        pass


def fsync_dir(d: Path) -> None:
    """Review F13: the new directory entry reaches the disk too (POSIX; best effort)."""
    if not _POSIX:
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


def _write_temp(path: Path, data: bytes, mode: int) -> Path:
    """Steps 2-3: a fresh temporary file beside `path` holding `data`, flushed. Removed again if anything fails."""
    tmp = path.with_name(f".{path.name}.{secrets.token_hex(4)}.tmp")
    fd = os.open(str(tmp), os.O_WRONLY | os.O_CREAT | os.O_EXCL | _BINARY, mode)
    try:
        try:
            view = memoryview(data)
            while view:
                n = os.write(fd, view)
                view = view[n:]
            os.fsync(fd)
        finally:
            os.close(fd)
    except BaseException:
        _discard(tmp)
        raise
    return tmp


def _discard(tmp: Path) -> None:
    try:
        tmp.unlink()
    except OSError:
        pass


def write_private(path: Path, data: bytes, *, mode: int = 0o600) -> None:
    """Write `data` to `path`, replacing any earlier file atomically (a password, a state file, a keyring, a private key).
    `mode` is 0600; the evidence keyring (public halves only) passes 0o666 so it keeps the mode `write_text` gave it."""
    p = Path(path)
    private_dir(p.parent)
    tmp = _write_temp(p, bytes(data), mode)
    try:
        os.replace(tmp, p)
        fsync_dir(p.parent)
    finally:
        _discard(tmp)


def create_private(path: Path, data: bytes) -> bytes:
    """Place `data` at `path` only if nothing is there yet (mode 0600). Returns the bytes now at `path`: `data`, or the
    file another process created between the caller's existence check and this call (it is never overwritten)."""
    p = Path(path)
    private_dir(p.parent)
    tmp = _write_temp(p, bytes(data), 0o600)
    try:
        try:
            os.link(tmp, p)  # fails when the file exists: never overwrites a key another process just created
        except FileExistsError:
            return p.read_bytes()
        except (OSError, NotImplementedError):  # a file system without hard links
            if p.exists():
                return p.read_bytes()
            os.replace(tmp, p)
        fsync_dir(p.parent)
        return bytes(data)
    finally:
        _discard(tmp)


def load_or_create_key(path: Path, lock: threading.Lock, size: int = 32, *, create: bool = True,
                       damaged: Callable[[], Exception]) -> bytes | None:
    """The `size`-byte random key at `path`, created on first use when `create` (else None when it is missing).
    A file of another length raises `damaged()` - a key is never silently replaced. Held under `lock` (one per key)."""
    p = Path(path)
    with lock:
        if p.exists():
            tighten(p)
            raw = p.read_bytes()
            if len(raw) != size:
                raise damaged()
            return raw
        if not create:
            return None
        raw = create_private(p, secrets.token_bytes(size))
        if len(raw) != size:
            raise damaged()
        return raw
