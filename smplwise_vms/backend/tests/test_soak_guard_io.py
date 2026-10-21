"""SMALL3-295: heartbeat / free-space / crash-reason helpers of the supervised soak tools (scripts/soak/soak_guard_io.py)."""
from __future__ import annotations

import errno
import importlib.util
import os
import sys
from pathlib import Path

import pytest

_SRC = Path(__file__).resolve().parents[3] / "scripts" / "soak" / "soak_guard_io.py"
_spec = importlib.util.spec_from_file_location("soak_guard_io", _SRC)
gio = importlib.util.module_from_spec(_spec)
sys.modules["soak_guard_io"] = gio
_spec.loader.exec_module(gio)


def test_heartbeat_is_written_atomically(tmp_path):
    p = tmp_path / "heartbeat.txt"
    assert gio.write_heartbeat(p, now=1_000_000) is True
    assert p.read_text() == "1000000"
    assert not (tmp_path / "heartbeat.txt.tmp").exists()
    assert gio.write_heartbeat(p, now=1_000_300) is True
    assert p.read_text() == "1000300"


def test_full_disk_is_logged_and_the_old_heartbeat_survives(tmp_path, monkeypatch):
    p = tmp_path / "heartbeat.txt"
    gio.write_heartbeat(p, now=1_000_000)
    seen = []

    def boom(*a, **k):
        raise OSError(errno.ENOSPC, "No space left on device")

    monkeypatch.setattr(gio.os, "fsync", boom)
    assert gio.write_heartbeat(p, log=lambda kind, **kw: seen.append((kind, kw)), now=1_000_600) is False
    assert seen and seen[0][0] == "heartbeat_write_failed" and seen[0][1]["errno"] == errno.ENOSPC
    assert p.read_text() == "1000000"  # untouched, not truncated
    assert not (tmp_path / "heartbeat.txt.tmp").exists()


def test_a_failing_logger_does_not_crash_the_writer(tmp_path, monkeypatch):
    monkeypatch.setattr(gio.os, "fsync", lambda fd: (_ for _ in ()).throw(OSError(errno.ENOSPC, "full")))

    def bad_log(*a, **k):
        raise OSError(errno.ENOSPC, "full")

    assert gio.write_heartbeat(tmp_path / "hb.txt", log=bad_log) is False


@pytest.mark.parametrize("content,why", [("", "empty"), ("  \n", "empty"), ("abc", "not_a_number"), ("0", "not_positive"),
                                         ("-5", "not_positive"), ("9999999999", "in_the_future")])
def test_unreadable_heartbeats_are_not_zero(tmp_path, content, why):
    p = tmp_path / "hb.txt"
    p.write_text(content)
    assert gio.read_heartbeat(p, now=1_000_000) == (None, why)


def test_missing_heartbeat_and_good_heartbeat(tmp_path):
    assert gio.read_heartbeat(tmp_path / "none.txt") == (None, "missing")
    p = tmp_path / "hb.txt"
    p.write_text("999000")
    assert gio.read_heartbeat(p, now=1_000_000) == (999000, "")


def test_age_of_an_empty_heartbeat_is_never_enormous(tmp_path):
    p = tmp_path / "hb.txt"
    p.write_text("")
    now = p.stat().st_mtime + 10
    age, basis, why = gio.heartbeat_age(p, fallback_epoch=now - 7200, now=now)
    assert (basis, why) == ("file_mtime", "empty") and 9 <= age <= 11  # not ~1.8e9 s
    age, basis, why = gio.heartbeat_age(tmp_path / "gone.txt", fallback_epoch=now - 7200, now=now)
    assert (basis, why) == ("mask_write_time", "missing") and age == 7200
    p.write_text(str(int(now) - 400))
    age, basis, why = gio.heartbeat_age(p, fallback_epoch=0, now=now)
    assert 400 <= age < 401 and (basis, why) == ("heartbeat", "")


def test_free_space_gate(tmp_path):
    ok, free = gio.check_free_space(tmp_path / "not" / "yet", minimum=1)
    assert ok and free > 0
    ok, free = gio.check_free_space(tmp_path, minimum=2 ** 62)
    assert not ok and free > 0
    assert gio.MIN_FREE_BYTES == 1024 ** 3


def test_free_space_gate_fails_closed_when_the_volume_is_unreadable(tmp_path, monkeypatch):
    monkeypatch.setattr(gio.shutil, "disk_usage", lambda p: (_ for _ in ()).throw(OSError(errno.EIO, "io")))
    assert gio.check_free_space(tmp_path) == (False, -1)


def test_crash_reason_is_logged_without_addresses():
    try:
        raise OSError(errno.ENOSPC, "No space left on device while talking to http://10.1.2.3:80/x 10.1.2.3")
    except OSError as exc:
        r = gio.crash_reason(exc)
    assert r["error"] == "OSError" and r["errno"] == 28 and r["no_space"] is True
    assert "10.1.2.3" not in str(r) and "http://" not in str(r)
    assert r["where"].startswith("test_soak_guard_io.py:")
