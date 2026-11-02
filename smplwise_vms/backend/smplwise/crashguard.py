"""Crash guard (SEGFAULT-PLAYBACK-2332, docs/changes/SEGFAULT-PLAYBACK-2332.md): the add-on keeps serving after the server
process dies from a signal, and the next native crash leaves a Python traceback.

Two halves, both standard library only (the supervisor half must not import the application: it outlives every crash of it).

THE SUPERVISOR (`python3 -m smplwise.crashguard`, started by run.sh in place of `python3 -m smplwise`)
- runs the server as a child process (stdout / stderr inherited, so the add-on log is unchanged) and forwards SIGTERM / SIGINT /
  SIGHUP to it; a stop asked from outside (the Supervisor stopping the add-on) is never treated as a crash: the supervisor waits for
  the child and exits with the child's code, as `exec python3 -m smplwise` did before;
- when the child dies FROM A SIGNAL (SIGSEGV, SIGABRT, SIGBUS, SIGILL, SIGFPE, SIGKILL of the OOM killer ...) that nobody asked for
  (SIGTERM / SIGINT / SIGHUP always count as a stop),
  the crash is recorded in `<data>/crash/restarts.json` (time, signal, uptime - never an address, a path of a user or a credential),
  the faulthandler tail of that run is copied to the add-on log, and the server is started again after a backoff
  (2, 4, 8 ... seconds, at most BACKOFF_MAX_S; a run that stayed up STABLE_S resets the backoff);
- an ordinary exit (code 0 or a positive code: a configuration error, an intended stop) ends the supervisor with that code - the
  container stops as before and Home Assistant's watchdog (config.yaml `watchdog:`) decides, exactly as before;
- SAFE MODE: SAFE_MODE_CRASHES native crashes within SAFE_MODE_WINDOW_S start the server with the pure-Python event loop and HTTP
  parser (`SW_UVICORN_LOOP=asyncio`, `SW_UVICORN_HTTP=h11`) instead of uvloop / httptools, the only native code that drives the
  playback relay sockets. It ends by itself once the window holds fewer crashes (checked at every start).
  ASYNCIO-DEFAULT-2342: asyncio + h11 are now the server's DEFAULT (`__main__.server_impl`); uvloop + httptools run only when the
  `server.fast_network` setting or SW_FAST_NETWORK opts in. Safe mode keeps its meaning: it forces asyncio + h11 over that opt-in, and
  crashes are recorded and restarted exactly as before whichever loop / parser the crashed run used.

THE FAULT HANDLER (`enable_faulthandler`, called by `python -m smplwise` at start-up)
- `faulthandler` writes the Python stack of every thread on SIGSEGV / SIGFPE / SIGABRT / SIGBUS / SIGILL to
  `<data>/crash/faulthandler.log` (append; the file is cut back when it grows past FAULT_LOG_MAX_BYTES), with a start marker per run;
  the supervisor prints that run's part to stderr after a crash, so the add-on log shows the traceback too.

`state_view()` is what the health report shows (services/health_report.py, Hebrew)."""
from __future__ import annotations

import datetime as dt
import json
import os
import signal
import subprocess
import sys
import threading
import time
from pathlib import Path
from typing import Any, Callable

BACKOFF_MIN_S = 2.0
BACKOFF_MAX_S = 60.0
STABLE_S = 600.0               # a run this long resets the backoff
SAFE_MODE_CRASHES = 2          # this many native crashes ...
SAFE_MODE_WINDOW_S = 6 * 3600  # ... within this window start the server in safe mode
RECENT_KEEP = 20               # crash records kept in restarts.json
FAULT_LOG_MAX_BYTES = 512 * 1024
FAULT_TAIL_BYTES = 16 * 1024   # at most this much of a run's faulthandler output is copied to the log
RUN_MARKER = "=== smplwise run "
STOP_SIGNALS = frozenset(int(getattr(signal, n)) for n in ("SIGTERM", "SIGINT", "SIGHUP") if hasattr(signal, n))

SIGNAL_NAMES = {int(getattr(signal, n)): n for n in ("SIGSEGV", "SIGABRT", "SIGBUS", "SIGILL", "SIGFPE", "SIGKILL", "SIGTERM", "SIGINT", "SIGHUP", "SIGQUIT", "SIGPIPE", "SIGTRAP")
                if hasattr(signal, n)}


def _now_iso(ts: float | None = None) -> str:
    return dt.datetime.fromtimestamp(time.time() if ts is None else ts, dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _parse_iso(s: str) -> float | None:
    try:
        return dt.datetime.strptime(s, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=dt.timezone.utc).timestamp()
    except (TypeError, ValueError):
        return None


def crash_dir(data_dir: Path) -> Path:
    return Path(data_dir) / "crash"


def state_path(data_dir: Path) -> Path:
    return crash_dir(data_dir) / "restarts.json"


def fault_log_path(data_dir: Path) -> Path:
    return crash_dir(data_dir) / "faulthandler.log"


# ---------------------------------------------------------------------------------------------------------------- pure rules

def classify_exit(returncode: int) -> tuple[str, int]:
    """("signal", signum) when the child died from a signal (Popen: a negative code; a shell's 128+n is not produced here),
    otherwise ("exit", code)."""
    if returncode < 0:
        return "signal", -returncode
    return "exit", returncode


def signal_name(signum: int) -> str:
    return SIGNAL_NAMES.get(signum, f"SIG{signum}")


def should_restart(returncode: int, stopping: bool) -> bool:
    """Restart only a death from a signal that nobody asked for. A stop forwarded by the supervisor, and every ordinary exit
    (0, or a positive code), end the supervisor with the child's code."""
    if stopping:
        return False
    kind, signum = classify_exit(returncode)
    # SIGTERM / SIGINT / SIGHUP are stop requests: at container stop s6 may signal every process before the supervisor's own
    # handler ran, and a child that dies from that must not be started again during the shutdown
    return kind == "signal" and signum not in STOP_SIGNALS


def next_backoff(consecutive: int) -> float:
    """Seconds to wait before restart number `consecutive` (1 = the first crash of a series): 2, 4, 8 ... capped."""
    n = max(1, int(consecutive))
    return float(min(BACKOFF_MAX_S, BACKOFF_MIN_S * (2 ** (n - 1))))


def crashes_within(state: dict[str, Any], now_ts: float, window_s: float) -> int:
    n = 0
    for rec in state.get("recent") or []:
        ts = _parse_iso(str(rec.get("at") or ""))
        if ts is not None and now_ts - ts <= window_s:
            n += 1
    return n


def safe_mode_due(state: dict[str, Any], now_ts: float) -> bool:
    return crashes_within(state, now_ts, SAFE_MODE_WINDOW_S) >= SAFE_MODE_CRASHES


def child_env(base: dict[str, str], safe_mode: bool) -> dict[str, str]:
    env = dict(base)
    env["PYTHONFAULTHANDLER"] = "1"  # the interpreter's own handler until enable_faulthandler() points it at the file
    if safe_mode:
        env["SW_UVICORN_LOOP"] = "asyncio"
        env["SW_UVICORN_HTTP"] = "h11"
        env["SW_SAFE_MODE"] = "1"
    else:
        for k in ("SW_UVICORN_LOOP", "SW_UVICORN_HTTP", "SW_SAFE_MODE"):
            env.pop(k, None)
    return env


# ---------------------------------------------------------------------------------------------------------------- state file

def read_state(data_dir: Path) -> dict[str, Any]:
    try:
        raw = json.loads(state_path(data_dir).read_text(encoding="utf-8"))
        return raw if isinstance(raw, dict) else {}
    except (OSError, ValueError):
        return {}


def _write_state(data_dir: Path, state: dict[str, Any]) -> None:
    p = state_path(data_dir)
    try:
        p.parent.mkdir(parents=True, exist_ok=True)
        tmp = p.with_name(p.name + ".tmp")
        tmp.write_text(json.dumps(state, ensure_ascii=False, indent=1), encoding="utf-8")
        os.replace(tmp, p)
    except OSError as exc:  # a full or read-only /data never stops the restart itself
        print(f"[crashguard] cannot write {p.name}: {type(exc).__name__}", file=sys.stderr, flush=True)


def record_crash(data_dir: Path, signum: int, uptime_s: float, safe_mode: bool, now_ts: float | None = None) -> dict[str, Any]:
    state = read_state(data_dir)
    rec = {"at": _now_iso(now_ts), "signal": signum, "name": signal_name(signum), "uptime_s": round(max(0.0, uptime_s), 1), "safe_mode": bool(safe_mode)}
    recent = [r for r in (state.get("recent") or []) if isinstance(r, dict)][-(RECENT_KEEP - 1):]
    recent.append(rec)
    state.update({"count_total": int(state.get("count_total") or 0) + 1, "recent": recent, "last": rec})
    _write_state(data_dir, state)
    return state


def record_start(data_dir: Path, safe_mode: bool, now_ts: float | None = None) -> None:
    state = read_state(data_dir)
    state.update({"safe_mode": bool(safe_mode), "last_start_at": _now_iso(now_ts), "starts": int(state.get("starts") or 0) + 1})
    _write_state(data_dir, state)


def state_view(data_dir: Path, now_ts: float | None = None) -> dict[str, Any]:
    """Counts and times only (the health report). `crashes_24h` drives the warning."""
    now_ts = time.time() if now_ts is None else now_ts
    st = read_state(data_dir)
    last = st.get("last") if isinstance(st.get("last"), dict) else None
    return {"count_total": int(st.get("count_total") or 0), "crashes_24h": crashes_within(st, now_ts, 86400), "safe_mode": bool(st.get("safe_mode")),
            "last_at": last.get("at") if last else None, "last_signal": last.get("name") if last else None,
            "last_uptime_s": last.get("uptime_s") if last else None, "supervised": os.environ.get("SW_SUPERVISED") == "1"}


# ---------------------------------------------------------------------------------------------------------------- faulthandler

_FAULT_FILE: Any = None  # kept open for the life of the process: faulthandler writes to its file descriptor


def enable_faulthandler(data_dir: Path) -> Path | None:
    """Point faulthandler at `<data>/crash/faulthandler.log` (all threads), with a run marker. Falls back to stderr when the file
    cannot be opened. Returns the file path, or None for stderr."""
    import faulthandler

    global _FAULT_FILE
    p = fault_log_path(data_dir)
    try:
        p.parent.mkdir(parents=True, exist_ok=True)
        if p.is_file() and p.stat().st_size > FAULT_LOG_MAX_BYTES:
            keep = p.read_bytes()[-FAULT_LOG_MAX_BYTES // 2:]
            p.write_bytes(keep)
        f = open(p, "a", encoding="utf-8", buffering=1)  # noqa: SIM115 - must stay open (faulthandler keeps the fd)
        f.write(f"{RUN_MARKER}pid={os.getpid()} at={_now_iso()} ===\n")
        f.flush()
    except OSError:
        faulthandler.enable(file=sys.stderr, all_threads=True)
        return None
    if _FAULT_FILE is not None and _FAULT_FILE is not f:
        try:
            _FAULT_FILE.close()
        except OSError:
            pass
    _FAULT_FILE = f
    faulthandler.enable(file=f, all_threads=True)
    return p


def last_run_fault_text(data_dir: Path, limit: int = FAULT_TAIL_BYTES) -> str:
    """The faulthandler output of the last run (after its marker), or "" when that run wrote nothing."""
    try:
        text = fault_log_path(data_dir).read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""
    i = text.rfind(RUN_MARKER)
    if i < 0:
        return text[-limit:].strip()
    j = text.find("\n", i)
    body = text[j + 1:] if j >= 0 else ""
    return body[-limit:].strip()


def native_versions() -> dict[str, str]:
    """The native libraries that run in the server process (logged at start-up, so a crash report names them)."""
    import importlib.metadata as md
    import platform
    import sqlite3

    out = {"python": platform.python_version(), "libc": "-".join(x for x in platform.libc_ver() if x) or "unknown", "sqlite": sqlite3.sqlite_version}
    for dist in ("uvloop", "httptools", "websockets", "uvicorn", "pillow", "numpy", "cryptography", "pydantic-core"):
        try:
            out[dist] = md.version(dist)
        except md.PackageNotFoundError:
            out[dist] = "-"
    return out


# ---------------------------------------------------------------------------------------------------------------- supervisor

class Supervisor:
    """The restart loop. `spawn(env) -> Popen-like` (`.wait()`, `.send_signal()`, `.poll()`), `sleep(s, stop_event)` and `clock()`
    are injectable for the tests."""

    def __init__(self, data_dir: Path, argv: list[str], *, spawn: Callable[[dict[str, str]], Any] | None = None,
                 sleep: Callable[[float, threading.Event], None] | None = None, clock: Callable[[], float] = time.time,
                 log: Callable[[str], None] | None = None, base_env: dict[str, str] | None = None) -> None:
        self.data_dir = Path(data_dir)
        self.argv = argv
        self.spawn = spawn or (lambda env: subprocess.Popen(self.argv, env=env))
        self.sleep = sleep or (lambda s, ev: ev.wait(s))
        self.clock = clock
        self.log = log or (lambda m: print(f"[crashguard] {m}", file=sys.stderr, flush=True))
        self.base_env = dict(os.environ if base_env is None else base_env)
        self.stop_event = threading.Event()
        self.child: Any = None
        self.restarts = 0

    def request_stop(self, signum: int) -> None:
        """A stop from outside: forwarded to the child; no restart afterwards."""
        self.stop_event.set()
        child = self.child
        if child is not None and child.poll() is None:
            try:
                child.send_signal(signum)
            except (OSError, ValueError):
                pass

    def run(self) -> int:
        consecutive = 0
        while True:
            safe = safe_mode_due(read_state(self.data_dir), self.clock())
            record_start(self.data_dir, safe, self.clock())
            env = child_env(self.base_env, safe)
            env["SW_SUPERVISED"] = "1"
            if safe:
                self.log("safe mode: repeated native crashes - this run uses the asyncio event loop and the h11 HTTP parser "
                         "(the default; it also overrides a fast-network opt-in)")
            started = self.clock()
            self.child = self.spawn(env)
            if self.stop_event.is_set():  # a stop arrived while the child was being started
                self.request_stop(signal.SIGTERM)
            code = self.child.wait()
            uptime = self.clock() - started
            if not should_restart(code, self.stop_event.is_set()):
                return code if code >= 0 else 128 + (-code)
            signum = classify_exit(code)[1]
            record_crash(self.data_dir, signum, uptime, safe, self.clock())
            tail = last_run_fault_text(self.data_dir)
            if tail:
                self.log("faulthandler output of the crashed run:\n" + tail)
            consecutive = 1 if uptime >= STABLE_S else consecutive + 1
            wait_s = next_backoff(consecutive)
            self.restarts += 1
            self.log(f"server process died from {signal_name(signum)} after {uptime:.0f} s; restart #{self.restarts} in {wait_s:.0f} s "
                     f"(state in {state_path(self.data_dir).relative_to(self.data_dir).as_posix()} under the data folder)")
            self.sleep(wait_s, self.stop_event)
            if self.stop_event.is_set():
                return 0


def main() -> int:
    data_dir = Path(os.environ.get("SW_DATA_DIR") or "/data")
    sup = Supervisor(data_dir, [sys.executable, "-m", "smplwise"])
    for name in ("SIGTERM", "SIGINT", "SIGHUP"):
        if hasattr(signal, name):
            signal.signal(getattr(signal, name), lambda signum, _frame: sup.request_stop(signum))
    return sup.run()


if __name__ == "__main__":
    sys.exit(main())
