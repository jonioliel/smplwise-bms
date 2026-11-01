"""SEGFAULT-PLAYBACK-2332: the crash guard restarts the server after a death from a signal (with backoff, a crash record under
/data/crash and safe mode after repeated crashes), never after an ordinary exit or a stop; faulthandler leaves a traceback in
<data>/crash/faulthandler.log; the health report shows the record in Hebrew. docs/changes/SEGFAULT-PLAYBACK-2332.md."""
from __future__ import annotations

import json
import os
import subprocess
import sys
import textwrap
from pathlib import Path

import pytest

from smplwise import crashguard as cg
from smplwise.__main__ import server_impl

ADDON = Path(__file__).resolve().parents[2]
BACKEND = Path(__file__).resolve().parents[1]
SEGV = -11  # Popen's code for a child killed by SIGSEGV (POSIX)
ABRT = -6
TERM = -15


# ------------------------------------------------------------------------------------------------------------- pure rules

def test_exit_classification_and_restart_rule():
    assert cg.classify_exit(SEGV) == ("signal", 11) and cg.classify_exit(0) == ("exit", 0) and cg.classify_exit(3) == ("exit", 3)
    assert cg.should_restart(SEGV, stopping=False) and cg.should_restart(ABRT, stopping=False) and cg.should_restart(-9, stopping=False)
    assert not cg.should_restart(SEGV, stopping=True), "a stop asked from outside is never a crash"
    assert not cg.should_restart(TERM, stopping=False) and not cg.should_restart(-2, stopping=False), "a stop signal is a stop, even before our own handler ran"
    assert not cg.should_restart(0, stopping=False) and not cg.should_restart(1, stopping=False), "an ordinary exit ends the add-on as before"


def test_backoff_doubles_and_is_capped():
    assert [cg.next_backoff(n) for n in range(1, 8)] == [2.0, 4.0, 8.0, 16.0, 32.0, 60.0, 60.0]
    assert cg.next_backoff(0) == 2.0


def test_safe_mode_needs_two_crashes_inside_the_window(tmp_path):
    now = 1_800_000_000.0
    cg.record_crash(tmp_path, 11, 30.0, False, now_ts=now - cg.SAFE_MODE_WINDOW_S - 60)
    cg.record_crash(tmp_path, 11, 30.0, False, now_ts=now - 10)
    st = cg.read_state(tmp_path)
    assert st["count_total"] == 2 and st["last"]["name"] == "SIGSEGV" and not cg.safe_mode_due(st, now), "the old crash is outside the window"
    cg.record_crash(tmp_path, 6, 5.0, False, now_ts=now - 5)
    assert cg.safe_mode_due(cg.read_state(tmp_path), now)
    assert not cg.safe_mode_due(cg.read_state(tmp_path), now + cg.SAFE_MODE_WINDOW_S + 1), "safe mode ends by itself"


def test_child_env_switches_to_pure_python_loop_in_safe_mode():
    base = {"PATH": "x", "SW_UVICORN_LOOP": "asyncio", "SW_SAFE_MODE": "1"}
    normal = cg.child_env(base, False)
    assert normal["PYTHONFAULTHANDLER"] == "1" and "SW_UVICORN_LOOP" not in normal and "SW_SAFE_MODE" not in normal
    safe = cg.child_env({"PATH": "x"}, True)
    assert safe["SW_UVICORN_LOOP"] == "asyncio" and safe["SW_UVICORN_HTTP"] == "h11" and safe["SW_SAFE_MODE"] == "1"
    fixed = {"PYTHONFAULTHANDLER", "SW_UVICORN_LOOP", "SW_UVICORN_HTTP", "SW_SAFE_MODE"}
    assert set(safe) - {"PATH"} <= fixed and set(normal) - set(base) <= fixed, "the server child gets the supervisor's environment plus fixed keys only"
    assert server_impl(safe) == ("asyncio", "h11") and server_impl({}) == ("auto", "auto") and server_impl({"SW_UVICORN_LOOP": "bogus"}) == ("auto", "auto")


def test_crash_record_keeps_a_bounded_history(tmp_path):
    for i in range(cg.RECENT_KEEP + 5):
        cg.record_crash(tmp_path, 11, float(i), False, now_ts=1_800_000_000.0 + i)
    st = cg.read_state(tmp_path)
    assert st["count_total"] == cg.RECENT_KEEP + 5 and len(st["recent"]) == cg.RECENT_KEEP
    raw = cg.state_path(tmp_path).read_text(encoding="utf-8")
    assert set(st["last"]) == {"at", "signal", "name", "uptime_s", "safe_mode"} and "/" not in raw, "times, signals and numbers only"


# ------------------------------------------------------------------------------------------------------------- the loop

class FakeChild:
    def __init__(self, code: int, on_wait=None):
        self.code, self.on_wait, self.signals, self.done = code, on_wait, [], False

    def wait(self):
        if self.on_wait:
            self.on_wait(self)
        self.done = True
        return self.code

    def poll(self):
        return self.code if self.done else None

    def send_signal(self, signum):
        self.signals.append(signum)


class Clock:
    def __init__(self):
        self.t = 1_800_000_000.0

    def __call__(self):
        return self.t


def _sup(tmp_path, codes, clock=None, run_s=5.0, sleep=None):
    clock = clock or Clock()
    envs, sleeps, logs = [], [], []

    def spawn(env):
        envs.append(env)
        clock.t += run_s
        return FakeChild(codes.pop(0))

    def fake_sleep(s, ev):
        sleeps.append(s)
        clock.t += s
        if sleep:
            sleep(s, ev)

    sup = cg.Supervisor(tmp_path, ["python", "-m", "smplwise"], spawn=spawn, sleep=fake_sleep, clock=clock, log=logs.append, base_env={"PATH": "x"})
    return sup, envs, sleeps, logs


def test_supervisor_restarts_after_native_crashes_then_enters_safe_mode(tmp_path):
    sup, envs, sleeps, logs = _sup(tmp_path, [SEGV, SEGV, 0])
    assert sup.run() == 0
    assert len(envs) == 3 and sleeps == [2.0, 4.0] and sup.restarts == 2
    assert all(e["SW_SUPERVISED"] == "1" and e["PYTHONFAULTHANDLER"] == "1" for e in envs)
    assert "SW_UVICORN_LOOP" not in envs[0] and "SW_UVICORN_LOOP" not in envs[1] and envs[2]["SW_UVICORN_LOOP"] == "asyncio", "safe mode from the 2nd crash on"
    st = cg.read_state(tmp_path)
    assert st["count_total"] == 2 and st["starts"] == 3 and st["safe_mode"] is True and st["last"]["name"] == "SIGSEGV"
    assert any("SIGSEGV" in m and "restart #2" in m for m in logs)


def test_ordinary_exit_and_stop_signal_end_the_supervisor(tmp_path):
    sup, envs, sleeps, _ = _sup(tmp_path, [3])
    assert sup.run() == 3 and len(envs) == 1 and not sleeps, "a configuration error still stops the add-on"
    sup, envs, sleeps, _ = _sup(tmp_path / "b", [TERM])
    assert sup.run() == 128 + 15 and len(envs) == 1 and not sleeps
    assert not cg.read_state(tmp_path).get("count_total") and not cg.read_state(tmp_path / "b").get("count_total"), "no crash recorded"


def test_stop_forwarded_to_the_child_is_not_a_crash(tmp_path):
    holder: dict = {}

    def spawn(env):
        child = FakeChild(SEGV, on_wait=lambda c: holder["sup"].request_stop(15))
        return child

    sup = cg.Supervisor(tmp_path, ["x"], spawn=spawn, sleep=lambda s, ev: None, log=lambda m: None, base_env={})
    holder["sup"] = sup
    assert sup.run() == 128 + 11 and sup.restarts == 0 and sup.child.signals == [15]
    assert not cg.read_state(tmp_path).get("count_total"), "nothing recorded for a stop"


def test_stop_during_backoff_exits_without_another_start(tmp_path):
    sup, envs, sleeps, _ = _sup(tmp_path, [SEGV, 0], sleep=lambda s, ev: ev.set())
    assert sup.run() == 0 and len(envs) == 1 and sleeps == [2.0]


def test_a_stable_run_resets_the_backoff(tmp_path):
    clock = Clock()
    runs = iter([5.0, 5.0, cg.STABLE_S + 1, 5.0])
    envs, sleeps = [], []

    def spawn(env):
        envs.append(env)
        clock.t += next(runs)
        return FakeChild([SEGV, SEGV, SEGV, 0][len(envs) - 1])

    def sleep(s, ev):
        sleeps.append(s)
        clock.t += cg.SAFE_MODE_WINDOW_S  # keep safe mode out of this test

    sup = cg.Supervisor(tmp_path, ["x"], spawn=spawn, sleep=sleep, clock=clock, log=lambda m: None, base_env={})
    assert sup.run() == 0 and sleeps == [2.0, 4.0, 2.0]


# ------------------------------------------------------------------------------------------------------------- faulthandler

CRASHER = textwrap.dedent("""
    import faulthandler, sys, threading, time
    from pathlib import Path
    sys.path.insert(0, {backend!r})
    from smplwise import crashguard
    crashguard.enable_faulthandler(Path({data!r}))
    def deep_in_the_relay():
        faulthandler._sigsegv()
    t = threading.Thread(target=time.sleep, args=(5,), name="other-worker", daemon=True); t.start()
    deep_in_the_relay()
""")


def _crash_once(data: Path) -> subprocess.CompletedProcess:
    code = CRASHER.format(backend=str(BACKEND), data=str(data))
    return subprocess.run([sys.executable, "-c", code], capture_output=True, text=True, timeout=60)


def test_faulthandler_writes_the_python_stack_of_a_native_crash_to_the_data_folder(tmp_path):
    proc = _crash_once(tmp_path)
    assert proc.returncode != 0
    text = cg.fault_log_path(tmp_path).read_text(encoding="utf-8", errors="replace")
    assert cg.RUN_MARKER in text and "deep_in_the_relay" in text, text[-2000:]
    assert ("Segmentation fault" in text) or ("access violation" in text)
    tail = cg.last_run_fault_text(tmp_path)
    assert "deep_in_the_relay" in tail and cg.RUN_MARKER not in tail
    _crash_once(tmp_path)  # a second run appends under its own marker
    assert cg.fault_log_path(tmp_path).read_text(encoding="utf-8", errors="replace").count(cg.RUN_MARKER) == 2


def test_fault_log_is_cut_back_when_large(tmp_path):
    p = cg.fault_log_path(tmp_path)
    p.parent.mkdir(parents=True)
    p.write_bytes(b"x" * (cg.FAULT_LOG_MAX_BYTES + 1000))
    code = f"import sys; sys.path.insert(0, {str(BACKEND)!r}); from pathlib import Path; from smplwise import crashguard; crashguard.enable_faulthandler(Path({str(tmp_path)!r}))"
    subprocess.run([sys.executable, "-c", code], check=True, timeout=60)
    assert p.stat().st_size < cg.FAULT_LOG_MAX_BYTES and cg.RUN_MARKER in p.read_text(encoding="utf-8", errors="replace")


@pytest.mark.skipif(os.name == "nt", reason="POSIX only: Windows reports an access violation as a positive exit code, not a signal")
def test_real_supervisor_restarts_a_segfaulting_child_and_copies_its_traceback(tmp_path):
    marker = tmp_path / "runs"
    child_code = textwrap.dedent(f"""
        import faulthandler, sys
        from pathlib import Path
        sys.path.insert(0, {str(BACKEND)!r})
        from smplwise import crashguard
        crashguard.enable_faulthandler(Path({str(tmp_path)!r}))
        m = Path({str(marker)!r}); n = int(m.read_text()) if m.exists() else 0; m.write_text(str(n + 1))
        if n == 0:
            faulthandler._sigsegv()
        sys.exit(0)
    """)
    logs: list[str] = []
    sup = cg.Supervisor(tmp_path, [sys.executable, "-c", child_code], sleep=lambda s, ev: None, log=logs.append)
    assert sup.run() == 0 and marker.read_text() == "2" and sup.restarts == 1
    assert cg.read_state(tmp_path)["last"]["name"] == "SIGSEGV"
    assert any("faulthandler output" in m and "Segmentation fault" in m for m in logs)


# ------------------------------------------------------------------------------------------------------------- add-on wiring

def test_run_script_starts_the_crash_guard_and_the_watchdog_stays():
    sh = (ADDON / "run.sh").read_text(encoding="utf-8")
    assert "exec python3 -m smplwise.crashguard" in sh and "exec python3 -m smplwise\n" not in sh
    assert "export PYTHONFAULTHANDLER=1" in sh
    assert "PYTHONFAULTHANDLER=1" in (ADDON / "Dockerfile").read_text(encoding="utf-8")
    cfg = (ADDON / "config.yaml").read_text(encoding="utf-8")
    assert "watchdog: http://[HOST]:[PORT:8099]/healthz" in cfg and "init: false" in cfg


def test_supervisor_module_imports_no_application_code():
    code = f"import sys; sys.path.insert(0, {str(BACKEND)!r}); import smplwise.crashguard; print(sorted(m for m in sys.modules if m.startswith('smplwise')))"
    out = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True, timeout=60, check=True).stdout
    assert json.loads(out.strip().replace("'", '"')) == ["smplwise", "smplwise.crashguard"]


def test_native_versions_line_names_the_libraries():
    v = cg.native_versions()
    assert {"python", "sqlite", "uvloop", "httptools", "websockets", "pillow"} <= set(v)


# ------------------------------------------------------------------------------------------------------------- health report

def test_health_report_and_summary_show_the_restarts_in_hebrew(settings):
    from fastapi.testclient import TestClient

    from conftest import seed_tree
    from smplwise.main import create_app

    c = TestClient(create_app(settings))
    seed_tree(c)
    ids = [x["id"] for x in c.get("/api/v1/health/report").json()["checks"]]
    assert "process_restarts" not in ids, "nothing to show before the first crash"
    assert not [i for i in c.get("/api/v1/health/summary").json()["items"] if i["id"] == "process_restarts"]

    cg.record_crash(settings.data_dir, 11, 3600.0, False)
    checks = {x["id"]: x for x in c.get("/api/v1/health/report").json()["checks"]}
    chk = checks["process_restarts"]
    assert chk["status"] == "warn" and chk["label"] == "הפעלות מחדש אחרי קריסה" and "SIGSEGV" in chk["detail"] and "קריסות ביממה האחרונה" in chk["detail"]
    assert chk["meta"]["crashes_24h"] == 1 and chk["meta"]["count_total"] == 1
    items = [i for i in c.get("/api/v1/health/summary").json()["items"] if i["id"] == "process_restarts"]
    assert items and items[0]["status"] == "warn" and "הופעל מחדש" in items[0]["label"]


def test_old_crash_is_listed_but_not_a_warning(settings):
    from fastapi.testclient import TestClient

    from conftest import seed_tree
    from smplwise.main import create_app

    cg.record_crash(settings.data_dir, 11, 10.0, False, now_ts=1_700_000_000.0)
    c = TestClient(create_app(settings))
    seed_tree(c)
    chk = {x["id"]: x for x in c.get("/api/v1/health/report").json()["checks"]}["process_restarts"]
    assert chk["status"] == "ok" and chk["meta"]["crashes_24h"] == 0
    assert not [i for i in c.get("/api/v1/health/summary").json()["items"] if i["id"] == "process_restarts"]

