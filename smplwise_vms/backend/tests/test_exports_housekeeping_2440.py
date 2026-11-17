"""CR-EXPORTS-HOUSEKEEPING-2440 (review 03:F08, 03:F18, 03:F26, 05:P3-06): the export download drains ffmpeg's stderr while it runs,
a stuck ffmpeg never leaks its command line, the revocation hook dispatches through an explicit table, and the two `wait_idle`
test helpers share one wait."""
from __future__ import annotations

import ast
import subprocess
import sys
import threading
import time
from dataclasses import replace
from pathlib import Path

import pytest

from smplwise.errors import ApiError
from smplwise.services import app_refresh, nvr_batch, nvr_verify
from smplwise.services.recorders import provision_playback as pp

BACKEND = Path(__file__).resolve().parents[1]
URI = "rtsp://nvr.local:554/chID=1&action=backup&startTime=1&endTime=2"

FAKE_FFMPEG = r'''
import sys, time
mode = sys.argv[1]
dest = sys.argv[-1]
line = ("[rtsp @ 0x1] error while decoding: " + "x" * 200 + "\n").encode()
if mode in ("chatty_ok", "chatty_fail"):
    n = 0
    while n < 200 * 1024:  # 200 KB: several times any pipe buffer
        sys.stderr.buffer.write(line)
        n += len(line)
    sys.stderr.buffer.flush()
if mode == "chatty_fail":
    sys.stderr.buffer.write(("Connection to " + sys.argv[2] + " failed: 401 Unauthorized user=admin pass=s3cret-pass\n").encode())
    sys.stderr.buffer.flush()
    sys.exit(1)
if mode == "hang":
    time.sleep(60)
with open(dest, "wb") as f:
    f.write(b"G" * 4096)
'''


@pytest.fixture
def download(settings, tmp_path, monkeypatch):
    """`rtsp_download` with ffmpeg replaced by a Python script (argv[1] = its mode, argv[2] = the input URL, argv[-1] = dest)."""
    script = tmp_path / "fake_ffmpeg.py"
    script.write_text(FAKE_FFMPEG, encoding="utf-8")
    s = replace(settings, nvr_host="nvr.local", nvr_user="admin", nvr_password="s3cret-pass")
    seen: dict = {}
    real_popen = subprocess.Popen

    def popen(args, **kw):
        url = args[args.index("-i") + 1]
        seen.update(args=list(args), url=url, kw=kw)
        kw.pop("env", None)  # the fake is a Python script: it starts with the interpreter's own environment on every platform
        return real_popen([sys.executable, str(script), seen["mode"], url, args[-1]], **kw)

    monkeypatch.setattr(pp.subprocess, "Popen", popen)
    monkeypatch.setattr("smplwise.mode.ensure_recorder_enabled", lambda _s: None)
    monkeypatch.setattr(pp, "export_url", lambda _s, uri: uri.replace("rtsp://", "rtsp://admin:s3cret-pass@"))

    def run(mode, **kw):
        seen["mode"] = mode
        dest = tmp_path / f"{mode}.ts"
        pp.rtsp_download(s, URI, dest, kw.pop("progress", None), ffmpeg="ffmpeg-fake", poll_s=0.05, **kw)
        return dest

    run.seen, run.tmp = seen, tmp_path
    return run


def test_a_chatty_ffmpeg_no_longer_blocks_the_download(download):
    """03:F08: 200 KB on stderr filled the pipe (it was read only after the process ended), ffmpeg blocked on the write and the
    export worker waited out the whole timeout."""
    t0 = time.monotonic()
    dest = download("chatty_ok", timeout_s=60)
    assert time.monotonic() - t0 < 30, "the download returned long before its timeout"
    assert dest.read_bytes() == b"G" * 4096
    assert download.seen["kw"]["stderr"] == subprocess.PIPE and download.seen["kw"]["stdout"] == subprocess.DEVNULL
    assert not [t for t in threading.enumerate() if t.name == "export-ffmpeg-stderr" and t.is_alive()], "the stderr reader ended with the process"


def test_a_failed_download_keeps_the_scrubbed_error_tail(download):
    with pytest.raises(ApiError) as exc:
        download("chatty_fail", timeout_s=60)
    err = exc.value
    assert err.code == "download_refused" and err.details["op"] == "download" and err.details["rc"] == 1
    text = err.details["error"]
    assert "401 Unauthorized" in text and len(text) <= 160, "the LAST of stderr is the error text, as before"
    assert "s3cret-pass" not in text and "admin" not in text and "nvr.local" not in text and "rtsp://" not in text
    assert not (download.tmp / "chatty_fail.ts").exists()


def test_an_aborted_download_is_cancelled_and_reaped(download):
    t0 = time.monotonic()
    with pytest.raises(ApiError) as exc:
        download("hang", timeout_s=60, progress=lambda _n: False)
    assert exc.value.code == "export_cancelled" and time.monotonic() - t0 < 20
    assert not (download.tmp / "hang.ts").exists()


def test_a_timed_out_download_is_cancelled(download):
    with pytest.raises(ApiError) as exc:
        download("hang", timeout_s=0.3)
    assert exc.value.code == "export_cancelled"


def test_an_ffmpeg_that_cannot_be_reaped_never_leaks_its_command_line(settings, tmp_path, monkeypatch):
    """05:P3-06: subprocess.TimeoutExpired carries the command line (the source URL with its credentials); the export worker logs an
    unexpected exception with its text. It never leaves the download."""

    class Stuck:
        """Says "ended" once (the progress loop is skipped), then cannot be reaped until it is killed."""

        stderr = None

        def __init__(self):
            self.returncode, self.killed, self.polls = None, 0, 0

        def poll(self):
            self.polls += 1
            if self.killed:
                return -9
            return 0 if self.polls == 1 else None

        def wait(self, timeout=None):
            if not self.killed:
                raise subprocess.TimeoutExpired(cmd=["ffmpeg", "-i", "rtsp://admin:s3cret-pass@nvr.local/x"], timeout=timeout)
            return -9

        def kill(self):
            self.killed += 1
            self.returncode = -9

    class Tail:
        def __init__(self, _stream, *a, **k):
            pass

        def result(self, timeout=5.0):
            return b""

    proc = Stuck()
    monkeypatch.setattr(pp.subprocess, "Popen", lambda args, **kw: proc)
    monkeypatch.setattr(pp, "_StderrTail", Tail)
    monkeypatch.setattr("smplwise.mode.ensure_recorder_enabled", lambda _s: None)
    monkeypatch.setattr(pp, "export_url", lambda _s, uri: uri)
    monkeypatch.setattr(pp, "DOWNLOAD_REAP_S", 0.01)
    with pytest.raises(ApiError) as exc:
        pp.rtsp_download(settings, URI, tmp_path / "x.ts", None, ffmpeg="ffmpeg-fake", poll_s=0.01)
    assert exc.value.code == "download_refused" and exc.value.details == {"op": "download", "error": "ffmpeg_stuck"}
    assert proc.killed == 1 and "s3cret" not in repr(exc.value.details) and not isinstance(exc.value.__cause__, subprocess.TimeoutExpired)
    assert exc.value.__context__ is None or "s3cret" not in str(exc.value.__context__), "no chained exception carries the command line"


def test_the_stderr_tail_keeps_only_the_last_bytes():
    import io

    tail = pp._StderrTail(io.BytesIO(b"a" * 50_000 + b"THE-END"), keep=64)
    out = tail.result()
    assert len(out) == 64 and out.endswith(b"THE-END")
    assert pp._StderrTail(io.BytesIO(b""), keep=64).result() == b""


# ---------------------------------------------------------------- 03:F18: the hook table

def test_the_hook_table_names_the_revocations_and_an_unknown_name_raises():
    assert set(app_refresh.HOOKS) == {"revoke_family", "revoke_device", "revoke_user", "revoke_anchor", "revoke_all", "revoke_kind"}
    for name, fn in app_refresh.HOOKS.items():
        assert fn is getattr(app_refresh, name), "each name is the function of that name (what globals() used to resolve)"
    with pytest.raises(KeyError):
        app_refresh.hook("revoke_usr", None, "u", "typo")  # a mistyped name was a warning line and a revocation that never ran
    with pytest.raises(KeyError):
        app_refresh.hook("hook", "revoke_user")  # nothing outside the table can be reached by name any more


def test_a_failing_revocation_is_still_logged_and_swallowed(monkeypatch, caplog):
    def boom(*a, **k):
        raise RuntimeError("db gone")

    monkeypatch.setitem(app_refresh.HOOKS, "revoke_user", boom)
    with caplog.at_level("WARNING", logger="smplwise.app_refresh"):
        assert app_refresh.hook("revoke_user", None, "u", "why") == 0
    assert any("app refresh revocation revoke_user failed" in r.getMessage() for r in caplog.records)
    monkeypatch.setitem(app_refresh.HOOKS, "revoke_user", lambda conn, user, reason, **kw: 3)
    assert app_refresh.hook("revoke_user", None, "u", "why", keep_anchor="a") == 3


def _hook_names_used() -> dict[str, list[str]]:
    """Every literal hook name in the product's source: `<x>.hook("name", ...)` on app_refresh, plus the names handed to
    presence._end_app_sign_ins (which passes its first argument on as the hook name)."""
    used: dict[str, list[str]] = {}
    for path in sorted((BACKEND / "smplwise").rglob("*.py")):
        text = path.read_text(encoding="utf-8")
        if "hook(" not in text and "_end_app_sign_ins(" not in text:
            continue
        for node in ast.walk(ast.parse(text)):
            if not isinstance(node, ast.Call) or not node.args:
                continue
            fn = node.func
            is_hook = isinstance(fn, ast.Attribute) and fn.attr == "hook" and isinstance(fn.value, ast.Name) and "app_refresh" in fn.value.id
            is_end = isinstance(fn, ast.Name) and fn.id == "_end_app_sign_ins"
            first = node.args[0]
            if (is_hook or is_end) and isinstance(first, ast.Constant) and isinstance(first.value, str):
                used.setdefault(first.value, []).append(f"{path.relative_to(BACKEND).as_posix()}:{node.lineno}")
    return used


def test_every_hook_name_a_caller_uses_is_in_the_table():
    used = _hook_names_used()
    assert {"revoke_user", "revoke_anchor", "revoke_kind", "revoke_device"} <= set(used), "the scan still finds the known callers"
    unknown = {name: where for name, where in used.items() if name not in app_refresh.HOOKS}
    assert not unknown, f"hook names with no entry in app_refresh.HOOKS: {unknown}"


def test_no_caller_passes_a_computed_hook_name_except_the_presence_wrapper():
    """A name that is not a literal cannot be checked by the test above; the one such call is presence._end_app_sign_ins, whose
    own callers are literals (and are scanned)."""
    computed = []
    for path in sorted((BACKEND / "smplwise").rglob("*.py")):
        text = path.read_text(encoding="utf-8")
        if "app_refresh.hook(" not in text:
            continue
        for node in ast.walk(ast.parse(text)):
            if (isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == "hook" and isinstance(node.func.value, ast.Name)
                    and "app_refresh" in node.func.value.id and node.args and not isinstance(node.args[0], ast.Constant)):
                computed.append(f"{path.relative_to(BACKEND).as_posix()}:{node.lineno}")
    assert len(computed) == 1 and computed[0].startswith("smplwise/services/presence.py:"), computed


# ---------------------------------------------------------------- 03:F26: one wait for the two test helpers

def test_threads_idle_waits_for_the_threads_and_times_out():
    lock, gate = threading.Lock(), threading.Event()
    t = threading.Thread(target=gate.wait, args=(5.0,), daemon=True)
    t.start()
    threads = {"a": t}
    t0 = time.monotonic()
    assert nvr_batch.threads_idle(lock, threads, 0.1) is False and time.monotonic() - t0 >= 0.1
    gate.set()
    assert nvr_batch.threads_idle(lock, threads, 3.0) is True
    assert nvr_batch.threads_idle(lock, {}, 0.5) is True
    assert nvr_batch.wait_idle(1.0) is True and nvr_verify.wait_idle(1.0) is True, "nothing runs in this test: both helpers are idle"
