"""CR-SECRET-FILES-2438 (code review 2026-11-13, 04:F09): every secret file is written by services/secret_files.

The finding: six writers of secret files, two weaker than the rest - the fleet state used a fixed `.tmp` name with `O_TRUNC`,
and the evidence keyring was written in place with `write_text` (the private key with no temporary file and no flush), so a
crash in the middle of `_save_keyring` replaced the signing identity. The interrupted write is simulated by a flush (`fsync`) of a
regular file that fails - a full disk, an I/O error, a power cut before the data is durable: whatever happens, the old file
stays exactly as it was and no temporary file is left behind."""
from __future__ import annotations

import os
import stat
import threading
from pathlib import Path

import pytest

from smplwise.services import alarm_codes, connection_store, fleet_keys, messaging_runtime, notify_email, secret_files, signing
from smplwise.services import notify_settings as nsettings


def _fail_file_fsync(monkeypatch, after: int = 0) -> list[int]:
    """`os.fsync` of a regular file raises once `after` such calls have succeeded (directory flushes are left alone)."""
    real = os.fsync
    calls: list[int] = []

    def fake(fd):
        if stat.S_ISDIR(os.fstat(fd).st_mode):
            return real(fd)
        calls.append(fd)
        if len(calls) > after:
            raise OSError(28, "No space left on device")
        return real(fd)

    monkeypatch.setattr(os, "fsync", fake)
    return calls


def _temps(d: Path) -> list[str]:
    return sorted(p.name for p in d.rglob("*.tmp")) if d.exists() else []


def _tree(d: Path) -> dict[str, bytes]:
    return {str(p.relative_to(d)): p.read_bytes() for p in sorted(d.rglob("*")) if p.is_file()}


# ---------------------------------------------------------------- the shared module

def test_write_private_replaces_and_keeps_binary_bytes(tmp_path):
    p = tmp_path / "keys" / "x.key"
    secret_files.write_private(p, b"\n\r\x00old")
    secret_files.write_private(p, b"\n\r\x00new\n")
    assert p.read_bytes() == b"\n\r\x00new\n", "binary: a 0x0A byte never becomes CR LF"
    assert _temps(tmp_path) == []
    if os.name == "posix":
        assert stat.S_IMODE(p.stat().st_mode) == 0o600
        assert stat.S_IMODE(p.parent.stat().st_mode) == 0o700


@pytest.mark.parametrize("stage", ["write", "fsync", "replace"])
def test_an_interrupted_write_private_leaves_the_old_file_and_no_temporary_file(tmp_path, monkeypatch, stage):
    p = tmp_path / "secrets" / "s"
    secret_files.write_private(p, b"old")
    boom = OSError(5, "Input/output error")
    if stage == "write":
        monkeypatch.setattr(os, "write", lambda fd, data: (_ for _ in ()).throw(boom))
    elif stage == "fsync":
        _fail_file_fsync(monkeypatch)
    else:
        monkeypatch.setattr(os, "replace", lambda a, b: (_ for _ in ()).throw(boom))
    with pytest.raises(OSError):
        secret_files.write_private(p, b"new-and-longer")
    monkeypatch.undo()
    assert p.read_bytes() == b"old"
    assert _temps(tmp_path) == []


def test_write_private_never_reuses_a_planted_temporary_name(tmp_path):
    p = tmp_path / "fleet" / "state.json"
    p.parent.mkdir(parents=True)
    planted = p.with_suffix(".json.tmp")
    planted.write_bytes(b"someone else's")
    secret_files.write_private(p, b"{}")
    assert planted.read_bytes() == b"someone else's"
    assert p.read_bytes() == b"{}"


def test_create_private_never_overwrites_and_returns_the_file_on_disk(tmp_path):
    p = tmp_path / "keys" / "k"
    assert secret_files.create_private(p, b"A" * 32) == b"A" * 32
    assert secret_files.create_private(p, b"B" * 32) == b"A" * 32
    assert p.read_bytes() == b"A" * 32 and _temps(tmp_path) == []


def test_load_or_create_key_create_flag_damaged_file_and_race(tmp_path, monkeypatch):
    lock = threading.Lock()
    p = tmp_path / "keys" / "k"
    damaged = lambda: ValueError("damaged")  # noqa: E731
    assert secret_files.load_or_create_key(p, lock, 32, create=False, damaged=damaged) is None and not p.exists()
    key = secret_files.load_or_create_key(p, lock, 32, damaged=damaged)
    assert len(key) == 32 and secret_files.load_or_create_key(p, lock, 32, create=False, damaged=damaged) == key
    p.write_bytes(b"short")
    with pytest.raises(ValueError, match="damaged"):
        secret_files.load_or_create_key(p, lock, 32, damaged=damaged)
    p.unlink()
    winner = b"W" * 32
    real_link = os.link

    def racing_link(src, dst):  # another process places its key between our existence check and our link
        Path(dst).write_bytes(winner)
        return real_link(src, dst)

    monkeypatch.setattr(os, "link", racing_link)
    assert secret_files.load_or_create_key(p, lock, 32, damaged=damaged) == winner
    assert p.read_bytes() == winner and _temps(tmp_path) == []


# ---------------------------------------------------------------- the evidence keyring (the weaker writer)

def test_an_interrupted_keyring_write_keeps_the_signing_identity(settings, monkeypatch):
    """Before: `_save_keyring` wrote in place without a flush, so the write 'succeeded' and the old ring was gone at once (a crash
    there left a damaged ring, answered by a new identity). After: the new ring takes the name only once it is on disk."""
    kid, _ = signing.ensure_active(settings)
    d = signing.keys_dir(settings)
    ring_before = (d / "keyring.json").read_bytes()
    _fail_file_fsync(monkeypatch, after=1)  # the private half is flushed, the keyring flush fails
    with pytest.raises(OSError):
        signing.rotate(settings)
    monkeypatch.undo()
    assert (d / "keyring.json").read_bytes() == ring_before
    assert signing.load_keyring(settings)["active"] == kid
    assert signing.ensure_active(settings)[0] == kid, "the same signing identity after the failed rotation"
    assert _temps(d) == []


def test_an_interrupted_private_key_write_leaves_no_empty_key_file(settings, monkeypatch):
    signing.ensure_active(settings)
    d = signing.keys_dir(settings)
    before = _tree(d)
    _fail_file_fsync(monkeypatch)
    with pytest.raises(OSError):
        signing.rotate(settings)
    monkeypatch.undo()
    assert _tree(d) == before, "nothing changed in keys/: no empty or half-written <kid>.key, keyring untouched"


def test_keyring_and_private_key_keep_their_content_and_modes(settings):
    kid, priv = signing.ensure_active(settings)
    d = signing.keys_dir(settings)
    ring = signing.load_keyring(settings)
    assert ring["active"] == kid and [k["kid"] for k in ring["keys"]] == [kid]
    assert (d / "keyring.json").read_text(encoding="utf-8").startswith('{\n  "active"')  # indent=2 JSON, as before
    assert (d / f"{kid}.key").read_bytes().startswith(b"-----BEGIN PRIVATE KEY-----")
    if os.name == "posix":
        assert stat.S_IMODE((d / f"{kid}.key").stat().st_mode) == 0o600
        assert stat.S_IMODE(d.stat().st_mode) == 0o700
        umask = os.umask(0)
        os.umask(umask)
        assert stat.S_IMODE((d / "keyring.json").stat().st_mode) == 0o666 & ~umask  # what write_text gave it


# ---------------------------------------------------------------- the fleet state (the other weaker writer)

def test_an_interrupted_fleet_state_write_leaves_the_old_state_and_no_fixed_tmp(settings, monkeypatch):
    """Before: the fixed `state.json.tmp` (O_TRUNC) stayed behind after a failed write and was reused by the next writer."""
    fleet_keys.ensure(settings)
    d = fleet_keys.fleet_dir(settings)
    state_before = (d / fleet_keys.STATE_NAME).read_bytes()
    _fail_file_fsync(monkeypatch)
    with pytest.raises(OSError):
        fleet_keys.next_seq(settings)
    monkeypatch.undo()
    assert (d / fleet_keys.STATE_NAME).read_bytes() == state_before
    assert _temps(d) == []
    assert fleet_keys.next_seq(settings) == 1


@pytest.mark.skipif(os.name != "posix", reason="symbolic links need privileges on Windows")
def test_a_planted_fleet_tmp_link_is_never_followed(settings, tmp_path):
    fleet_keys.ensure(settings)
    d = fleet_keys.fleet_dir(settings)
    outside = tmp_path / "outside.txt"
    outside.write_text("untouched", encoding="utf-8")
    (d / (fleet_keys.STATE_NAME + ".tmp")).symlink_to(outside)
    fleet_keys.next_seq(settings)
    assert outside.read_text(encoding="utf-8") == "untouched"
    assert not (d / fleet_keys.STATE_NAME).is_symlink()


# ---------------------------------------------------------------- the stronger writers: same sequence, no stray temporary file

def test_an_interrupted_alarm_code_key_creation_leaves_nothing(settings, monkeypatch):
    _fail_file_fsync(monkeypatch)
    with pytest.raises(OSError):
        alarm_codes.encrypt(settings, "alarm_control_panel.x", "123456")
    monkeypatch.undo()
    assert not alarm_codes.key_path(settings).exists()
    assert _temps(settings.data_dir) == []
    blob = alarm_codes.encrypt(settings, "alarm_control_panel.x", "123456")
    assert alarm_codes.decrypt(settings, "alarm_control_panel.x", blob) == "123456"


def test_an_interrupted_messaging_key_creation_leaves_nothing(tmp_path, monkeypatch):
    _fail_file_fsync(monkeypatch)
    with pytest.raises(OSError):
        messaging_runtime.messaging_key(tmp_path)
    monkeypatch.undo()
    assert not messaging_runtime.key_path(tmp_path).exists() and _temps(tmp_path) == []
    key = messaging_runtime.messaging_key(tmp_path)
    assert len(key) == 32 and messaging_runtime.messaging_key(tmp_path, create=False) == key


def test_an_interrupted_email_password_write_keeps_the_old_password(tmp_path, monkeypatch):
    notify_email.write_password(tmp_path, "old-secret")
    _fail_file_fsync(monkeypatch)
    with pytest.raises(OSError):
        notify_email.write_password(tmp_path, "new-secret")
    monkeypatch.undo()
    assert nsettings.secret_path(tmp_path).read_bytes() == b"old-secret"
    assert _temps(tmp_path) == []
    notify_email.write_password(tmp_path, "new-secret")
    assert nsettings.secret_path(tmp_path).read_bytes() == b"new-secret"


def test_an_interrupted_connection_key_creation_leaves_nothing(settings, monkeypatch):
    _fail_file_fsync(monkeypatch)
    with pytest.raises(OSError):
        connection_store._load_or_create_key(settings, create=True)
    monkeypatch.undo()
    assert not connection_store.key_path(settings).exists() and _temps(settings.data_dir) == []
