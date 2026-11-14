"""SUPPLIERDOCS-297: the tier-1 text source - poppler's `pdftotext` (poppler-utils is already in the add-on image for plan rendering;
no new dependency, a GPL tool used as a separate process, see docs/security/DEPENDENCY_AND_SECRETS_AUDIT.md).

poppler PARSES an untrusted file here (a supplier's PDF). The cost-file check at attach time (no active content, no encryption,
<= 10 MiB) is a filter, not a guarantee, so the child is treated as hostile (security review SUPPLIERDOCS2-297, finding F4):

* Prechecks BEFORE any child starts (pure Python, linear): size <= INPUT_MAX_BYTES, a `%PDF-` header and a `%%EOF` marker, no
  `/Encrypt` dictionary (no password prompts, no attempts), and the declared page count (the `/Pages` `/Count`, or the number of
  `/Type /Page` objects when no count is visible) <= the cap. A refused file never reaches the tool.
* The child never sees a user-controlled path or name: the checked BYTES are written to a fresh private temp directory as the
  generated name `in.pdf`, the child's working directory is that directory, the argument list ends with `--` before the file name,
  and the directory is removed afterwards. No shell, an argument list only, `close_fds`, stdin from the null device, stderr discarded.
* The environment is `minimal_env()` (no SUPERVISOR_TOKEN, no secret, no proxy variable) with HOME / TMPDIR pointing at the private
  directory.
* The tool reads at most `max_pages + 1` pages (`-l`), its output is read up to OUTPUT_MAX + 1 bytes (never buffered whole, F2) and
  the wall-clock timeout kills it.
* Operating-system limits (see `Limits` and `enforcement()` for what is enforced where):
  - POSIX (the add-on and the Linux runner): the child is started through a tiny `python -I -S` trampoline that sets RLIMIT_AS,
    RLIMIT_CPU, RLIMIT_FSIZE (0), RLIMIT_NOFILE, RLIMIT_NPROC (0) and RLIMIT_CORE (0) on ITSELF and then exec()s the tool (the
    `bill_pdf_engine.apply_limits` pattern: a `preexec_fn` is not thread-safe inside the web server). The child gets its own
    session (`start_new_session`), and a timeout, the output cap or the end of the read kills the whole process group (SIGKILL).
    The trampoline fails closed (exit 125, nothing read) when a limit cannot be set.
  - Windows (developer workstation only): the child is created suspended, put into a Job Object (process memory, job memory, user
    CPU time, ONE active process, kill-on-close, die on unhandled exception) and only then resumed; a timeout terminates the job.
    When a Job Object cannot be created or assigned the child still runs, with the timeout, the output cap and a `taskkill /T /F`
    tree kill; `enforcement()` says so.
* Any failure is a RESULT, never an exception: the service stores `state = failed` with an audit row (`docread.read`, `reason`)."""
from __future__ import annotations

import json
import logging
import os
import re
import shutil
import signal
import subprocess
import sys
import tempfile
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Sequence

from ..child_env import minimal_env
from .ports import TextResult

log = logging.getLogger(__name__)

TIMEOUT_S = 20
OUTPUT_MAX = 1024 * 1024            # 1 MiB of text
MIN_TEXT_CHARS = 10                 # fewer visible characters than this = no usable text layer (a scan)
INPUT_MAX_BYTES = 10 * 1024 * 1024  # the maintenance / cost-file intake cap; a larger file is never handed to the tool
MEMORY_MAX = 512 * 1024 * 1024      # address space (POSIX) / committed memory (Windows job) of the tool
OPEN_FILES_MAX = 32                 # POSIX RLIMIT_NOFILE
INPUT_NAME = "in.pdf"               # the generated name the tool sees (never the stored or the uploaded name)
LIMITS_FAILED_RC = 125              # the POSIX trampoline could not set a limit: fail closed

IS_POSIX = os.name == "posix"
IS_WINDOWS = os.name == "nt"


@dataclass(frozen=True)
class Limits:
    timeout_s: float = TIMEOUT_S        # wall clock, every OS
    cpu_s: int = TIMEOUT_S              # RLIMIT_CPU (POSIX) / per-process user time (Windows job)
    memory_bytes: int = MEMORY_MAX      # RLIMIT_AS (POSIX) / process + job memory (Windows job)
    output_bytes: int = OUTPUT_MAX      # bytes read from stdout before the child is killed, every OS
    open_files: int = OPEN_FILES_MAX    # RLIMIT_NOFILE (POSIX only)
    file_size: int = 0                  # RLIMIT_FSIZE (POSIX only): the tool writes to a pipe, never a file
    processes: int = 0                  # RLIMIT_NPROC (POSIX; not enforced for root) / the job allows only the tool itself

    def as_posix(self) -> dict[str, int]:
        return {"as": int(self.memory_bytes), "cpu": max(1, int(self.cpu_s)), "fsize": int(self.file_size),
                "nofile": int(self.open_files), "nproc": int(self.processes), "core": 0}


@dataclass
class ChildResult:
    status: str                    # ok | too_big | timeout | unavailable
    rc: int = -1
    out: bytes = b""
    enforced: tuple[str, ...] = field(default_factory=tuple)


# ---------------------------------------------------------------- POSIX: the limit trampoline

# Runs as `python -I -S -c TRAMPOLINE <limits json> <tool> <args...>`: sets the limits on itself (soft = hard, so the tool cannot raise
# them; CPU gets hard = soft + 1 so SIGXCPU comes first and SIGKILL follows), then exec()s the tool, which keeps them. Any limit that
# cannot be set makes it exit 125 before the tool starts (fail closed); RLIMIT_NPROC / RLIMIT_CORE are best effort.
TRAMPOLINE = r"""
import json, os, resource, sys
lim = json.loads(sys.argv[1])
def put(which, soft, hard, required):
    try:
        cur_soft, cur_hard = resource.getrlimit(which)
        if cur_hard != resource.RLIM_INFINITY:
            soft, hard = min(soft, cur_hard), min(hard, cur_hard)
        resource.setrlimit(which, (soft, hard))
    except (ValueError, OSError):
        if required:
            os._exit(125)
put(resource.RLIMIT_AS, lim["as"], lim["as"], True)
put(resource.RLIMIT_CPU, lim["cpu"], lim["cpu"] + 1, True)
put(resource.RLIMIT_FSIZE, lim["fsize"], lim["fsize"], True)
put(resource.RLIMIT_NOFILE, lim["nofile"], lim["nofile"], True)
put(resource.RLIMIT_CORE, 0, 0, False)
if hasattr(resource, "RLIMIT_NPROC"):
    put(resource.RLIMIT_NPROC, lim["nproc"], lim["nproc"], False)
try:
    os.execv(sys.argv[2], sys.argv[2:])
except OSError:
    os._exit(127)
"""

POSIX_ENFORCED = ("timeout", "output_cap", "rlimit_as", "rlimit_cpu", "rlimit_fsize", "rlimit_nofile", "rlimit_nproc", "rlimit_core",
                  "own_session", "process_group_kill")
WINDOWS_JOB_ENFORCED = ("timeout", "output_cap", "job_process_memory", "job_memory", "job_cpu_time", "job_one_process",
                        "job_kill_on_close", "job_tree_kill")
WINDOWS_FALLBACK_ENFORCED = ("timeout", "output_cap", "taskkill_tree_kill")


def posix_argv(cmd: Sequence[str], limits: Limits) -> list[str]:
    """The command as the POSIX trampoline runs it (the limits travel as one JSON argument, never through a shell)."""
    return [sys.executable, "-I", "-S", "-c", TRAMPOLINE, json.dumps(limits.as_posix(), sort_keys=True), *cmd]


def enforcement() -> dict[str, Any]:
    """What this operating system enforces on the child, and what it does not (stated, not assumed)."""
    if IS_POSIX:
        return {"os": "posix", "enforced": list(POSIX_ENFORCED),
                "not_enforced": ["filesystem confinement (the tool runs as the add-on user)", "network namespace / seccomp",
                                 "RLIMIT_NPROC when the add-on runs as root"]}
    return {"os": "windows" if IS_WINDOWS else os.name, "enforced": list(WINDOWS_JOB_ENFORCED),
            "fallback": list(WINDOWS_FALLBACK_ENFORCED),
            "not_enforced": ["file-size limit", "open-files limit", "filesystem confinement", "network block"]}


# ---------------------------------------------------------------- Windows: a Job Object (developer workstation)

CREATE_SUSPENDED = 0x00000004
CREATE_NO_WINDOW = 0x08000000
_JOB_LIMIT_PROCESS_TIME = 0x00000002
_JOB_LIMIT_ACTIVE_PROCESS = 0x00000008
_JOB_LIMIT_PROCESS_MEMORY = 0x00000100
_JOB_LIMIT_JOB_MEMORY = 0x00000200
_JOB_LIMIT_DIE_ON_UNHANDLED_EXCEPTION = 0x00000400
_JOB_LIMIT_KILL_ON_JOB_CLOSE = 0x00002000
_JOB_EXTENDED_LIMIT_INFORMATION = 9


class WinJob:
    """A Job Object holding exactly one process. Every call is best effort and never raises."""

    def __init__(self, limits: Limits) -> None:
        import ctypes
        from ctypes import wintypes

        self._ct = ctypes
        self._k32 = ctypes.WinDLL("kernel32", use_last_error=True)
        self._k32.CreateJobObjectW.restype = wintypes.HANDLE
        self._k32.CreateJobObjectW.argtypes = (ctypes.c_void_p, wintypes.LPCWSTR)
        self._k32.SetInformationJobObject.argtypes = (wintypes.HANDLE, ctypes.c_int, ctypes.c_void_p, wintypes.DWORD)
        self._k32.AssignProcessToJobObject.argtypes = (wintypes.HANDLE, wintypes.HANDLE)
        self._k32.TerminateJobObject.argtypes = (wintypes.HANDLE, wintypes.UINT)
        self._k32.CloseHandle.argtypes = (wintypes.HANDLE,)

        class IoCounters(ctypes.Structure):
            _fields_ = [(n, ctypes.c_ulonglong) for n in ("ReadOperationCount", "WriteOperationCount", "OtherOperationCount",
                                                           "ReadTransferCount", "WriteTransferCount", "OtherTransferCount")]

        class Basic(ctypes.Structure):
            _fields_ = [("PerProcessUserTimeLimit", ctypes.c_int64), ("PerJobUserTimeLimit", ctypes.c_int64), ("LimitFlags", wintypes.DWORD),
                        ("MinimumWorkingSetSize", ctypes.c_size_t), ("MaximumWorkingSetSize", ctypes.c_size_t),
                        ("ActiveProcessLimit", wintypes.DWORD), ("Affinity", ctypes.c_size_t), ("PriorityClass", wintypes.DWORD),
                        ("SchedulingClass", wintypes.DWORD)]

        class Extended(ctypes.Structure):
            _fields_ = [("BasicLimitInformation", Basic), ("IoInfo", IoCounters), ("ProcessMemoryLimit", ctypes.c_size_t),
                        ("JobMemoryLimit", ctypes.c_size_t), ("PeakProcessMemoryUsed", ctypes.c_size_t), ("PeakJobMemoryUsed", ctypes.c_size_t)]

        self.handle = self._k32.CreateJobObjectW(None, None)
        if not self.handle:
            raise OSError("CreateJobObjectW failed")
        info = Extended()
        info.BasicLimitInformation.LimitFlags = (_JOB_LIMIT_PROCESS_TIME | _JOB_LIMIT_ACTIVE_PROCESS | _JOB_LIMIT_PROCESS_MEMORY
                                                 | _JOB_LIMIT_JOB_MEMORY | _JOB_LIMIT_DIE_ON_UNHANDLED_EXCEPTION | _JOB_LIMIT_KILL_ON_JOB_CLOSE)
        info.BasicLimitInformation.PerProcessUserTimeLimit = max(1, int(limits.cpu_s)) * 10_000_000  # 100 ns units
        info.BasicLimitInformation.ActiveProcessLimit = 1
        info.ProcessMemoryLimit = int(limits.memory_bytes)
        info.JobMemoryLimit = int(limits.memory_bytes)
        self.limits = {"cpu_s": max(1, int(limits.cpu_s)), "memory_bytes": int(limits.memory_bytes), "active_processes": 1}
        if not self._k32.SetInformationJobObject(self.handle, _JOB_EXTENDED_LIMIT_INFORMATION, ctypes.byref(info), ctypes.sizeof(info)):
            self.close()
            raise OSError("SetInformationJobObject failed")

    def assign_and_resume(self, proc: subprocess.Popen) -> bool:
        """Put the SUSPENDED child into the job, then let it run. False = not assigned (the caller resumes or kills it)."""
        h = int(proc._handle)  # type: ignore[attr-defined]
        return bool(self._k32.AssignProcessToJobObject(self.handle, h)) and resume(proc)

    def terminate(self) -> None:
        if self.handle:
            self._k32.TerminateJobObject(self.handle, 1)

    def close(self) -> None:
        if self.handle:
            self._k32.CloseHandle(self.handle)  # KILL_ON_JOB_CLOSE: nothing of the job survives this
            self.handle = None


def resume(proc: subprocess.Popen) -> bool:
    """Resume a child created with CREATE_SUSPENDED (Windows)."""
    import ctypes
    from ctypes import wintypes

    nt = ctypes.WinDLL("ntdll")
    nt.NtResumeProcess.argtypes = (wintypes.HANDLE,)
    nt.NtResumeProcess.restype = ctypes.c_long
    return nt.NtResumeProcess(int(proc._handle)) == 0  # type: ignore[attr-defined]


def _taskkill_tree(pid: int) -> None:
    root = os.environ.get("SYSTEMROOT", r"C:\Windows")
    try:
        subprocess.run([os.path.join(root, "System32", "taskkill.exe"), "/T", "/F", "/PID", str(int(pid))], stdin=subprocess.DEVNULL,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, env=minimal_env(), timeout=10, check=False)
    except (OSError, subprocess.SubprocessError):
        pass


# ---------------------------------------------------------------- running one bounded child

def run_limited(cmd: Sequence[str], *, limits: Limits, cwd: str | os.PathLike[str] | None = None,
                env_extra: dict[str, str] | None = None) -> ChildResult:
    """Run `cmd` (an argument list, never a shell) under `limits`; read at most `limits.output_bytes + 1` bytes of stdout. The child
    and everything it started are killed at the cap, at the deadline and at the end. Never raises for a child failure. The environment is
    always `minimal_env(env_extra)` (`env_extra`: fixed, non-secret values such as HOME of the private directory)."""
    if not cmd or not os.path.isfile(cmd[0]) or (IS_POSIX and not os.access(cmd[0], os.X_OK)):
        return ChildResult("unavailable")  # the trampoline would only find out after it started
    kwargs: dict[str, Any] = {"stdin": subprocess.DEVNULL, "stdout": subprocess.PIPE, "stderr": subprocess.DEVNULL,
                              "cwd": os.fspath(cwd) if cwd is not None else None, "close_fds": True, "shell": False}
    job: WinJob | None = None
    if IS_POSIX:
        argv = posix_argv(cmd, limits)
        kwargs["start_new_session"] = True  # own session + process group: only this child tree is ever signalled
        enforced = POSIX_ENFORCED
    else:
        argv = list(cmd)
        flags = CREATE_NO_WINDOW
        if IS_WINDOWS:
            try:
                job = WinJob(limits)
                flags |= CREATE_SUSPENDED
            except (OSError, AttributeError, ValueError) as exc:
                log.warning("docread: no Job Object for the PDF reader (%s); timeout + taskkill only", type(exc).__name__)
                job = None
        kwargs["creationflags"] = flags
        enforced = WINDOWS_FALLBACK_ENFORCED
    try:
        proc = subprocess.Popen(argv, env=minimal_env(env_extra), **kwargs)
    except (OSError, ValueError):
        if job:
            job.close()
        return ChildResult("unavailable")
    if job is not None:
        if job.assign_and_resume(proc):
            enforced = WINDOWS_JOB_ENFORCED
        else:
            log.warning("docread: the PDF reader could not join its Job Object; timeout + taskkill only")
            job.close()
            job = None
            if not resume(proc):
                proc.kill()
                proc.wait(timeout=5)
                return ChildResult("unavailable")

    def kill_tree() -> None:
        try:
            if IS_POSIX:
                os.killpg(proc.pid, signal.SIGKILL)  # the group created for this child (its pid is its pgid)
            elif job is not None:
                job.terminate()
            elif proc.poll() is None:  # fallback: only a still-running child is worth a taskkill
                _taskkill_tree(proc.pid)
        except (ProcessLookupError, PermissionError, OSError):
            pass
        try:
            proc.kill()
        except OSError:
            pass

    deadline = time.monotonic() + max(float(limits.timeout_s), 0.1)
    cap = int(limits.output_bytes)
    box: dict[str, bytes] = {}

    def pump() -> None:
        try:
            box["out"] = proc.stdout.read(cap + 1) if proc.stdout else b""
        except (OSError, ValueError):
            box["out"] = b""

    t = threading.Thread(target=pump, name="docread-pdftotext", daemon=True)
    t.start()
    status, rc, out = "ok", -1, b""
    try:
        t.join(max(deadline - time.monotonic(), 0.0))
        if t.is_alive():
            status = "timeout"
        else:
            out = box.get("out", b"")
            if len(out) > cap:
                status, out = "too_big", b""
            else:
                rc = _wait_unreaped(proc, deadline)
                if rc is None:
                    status, out = "timeout", b""
    finally:
        kill_tree()  # stragglers of a finished child too (POSIX: the zombie leader still holds the group id)
        try:
            waited = proc.wait(timeout=5)
            if status == "ok" and rc == -1:
                rc = waited
        except subprocess.TimeoutExpired:
            pass
        if proc.stdout:
            try:
                proc.stdout.close()
            except OSError:
                pass
        t.join(1.0)
        if job is not None:
            job.close()
    return ChildResult(status, rc, out, tuple(enforced))


def _wait_unreaped(proc: subprocess.Popen, deadline: float) -> int | None:
    """Wait for the child's exit WITHOUT reaping it on POSIX (so its pid / group id cannot be reused before the group kill); the exit
    code is read later by `proc.wait()`. Returns -1 (exit seen) or None (deadline passed)."""
    if IS_POSIX and hasattr(os, "waitid") and hasattr(os, "WNOWAIT"):
        while time.monotonic() < deadline:
            try:
                if os.waitid(os.P_PID, proc.pid, os.WEXITED | os.WNOHANG | os.WNOWAIT) is not None:
                    return -1
            except ChildProcessError:
                return -1
            time.sleep(0.02)
        return None
    try:
        return proc.wait(timeout=max(deadline - time.monotonic(), 0.1))
    except subprocess.TimeoutExpired:
        return None


def run_capped(cmd: list[str], *, timeout_s: float, cap: int) -> tuple[str, int, bytes]:
    """F2 compatibility wrapper: (status, returncode, stdout) under the default limits with `timeout_s` / `cap`."""
    r = run_limited(cmd, limits=Limits(timeout_s=timeout_s, cpu_s=max(1, int(timeout_s)), output_bytes=cap))
    return r.status, r.rc, r.out


# ---------------------------------------------------------------- prechecks (before any child)

_ENCRYPT = re.compile(rb"/Encrypt(?![A-Za-z0-9])")
_PAGE_LEAF = re.compile(rb"/Type\s*/Page(?![A-Za-z0-9])")
_PAGES_NODE = re.compile(rb"/Type\s*/Pages(?![A-Za-z0-9])")
_COUNT = re.compile(rb"/Count\s+(\d{1,9})")
_PAGES_NODES_SCANNED = 4096
_WINDOW = 4096


def precheck(data: bytes, max_pages: int) -> tuple[str, int]:
    """(refusal reason or "", the declared page count). Linear scans only; a heuristic for the page count (an object-stream PDF hides
    its page tree - then `-l max_pages + 1` and the counted form feeds are the enforcement)."""
    if len(data) > INPUT_MAX_BYTES:
        return "file_too_large", 0
    if b"%PDF-" not in data[:1024] or b"%%EOF" not in data:
        return "malformed", 0
    if _ENCRYPT.search(data):
        return "encrypted", 0
    declared = 0
    for i, m in enumerate(_PAGES_NODE.finditer(data)):
        if i >= _PAGES_NODES_SCANNED:
            break
        start = data.rfind(b"<<", max(0, m.start() - _WINDOW), m.start())
        end = data.find(b">>", m.end(), m.end() + _WINDOW)
        if start < 0 or end < 0:
            continue
        c = _COUNT.search(data, start, end)
        if c:
            declared = max(declared, int(c.group(1)))
    pages = declared or sum(1 for _ in _PAGE_LEAF.finditer(data))
    if pages > max_pages:
        return "too_many_pages", pages
    return "", pages


# ---------------------------------------------------------------- the reader

class PdftotextReader:
    name = "pdftotext"

    def __init__(self, timeout_s: int = TIMEOUT_S, *, tool: Sequence[str] | None = None, limits: Limits | None = None) -> None:
        """`tool`: the argument prefix of the binary (tests pass a fake); default `pdftotext` from PATH."""
        self.timeout_s = min(max(int(timeout_s), 1), 30)
        self.limits = limits or Limits(timeout_s=self.timeout_s, cpu_s=self.timeout_s)
        self._tool = list(tool) if tool else None

    def command(self, max_pages: int, tool: Sequence[str]) -> list[str]:
        """The fixed argument list: no option is ever taken from the file or its name; `--` ends the options before the generated name."""
        return [*tool, "-layout", "-enc", "UTF-8", "-q", "-f", "1", "-l", str(int(max_pages) + 1), "--", INPUT_NAME, "-"]

    def read(self, path: Path, *, max_pages: int) -> TextResult:
        try:
            return self._read(Path(path), int(max_pages))
        except Exception as exc:  # noqa: BLE001 - a reader failure is a result, never a 500
            log.warning("docread: the PDF reader failed (%s)", type(exc).__name__)
            return TextResult(status="unreadable", engine=self.name, reason="reader_error")

    def _read(self, path: Path, max_pages: int) -> TextResult:
        tool = self._tool
        if tool is None:
            found = shutil.which("pdftotext")
            tool = [found] if found else None
        if not tool or not Path(tool[0]).is_file():
            return TextResult(status="unavailable", reason="binary_missing")
        if path.stat().st_size > INPUT_MAX_BYTES:
            return TextResult(status="unreadable", engine=self.name, reason="file_too_large")
        with path.open("rb") as fh:
            data = fh.read(INPUT_MAX_BYTES + 1)
        reason, declared = precheck(data, max_pages)
        if reason == "too_many_pages":
            return TextResult(status="too_many_pages", pages=declared, engine=self.name, reason=reason)
        if reason:
            return TextResult(status="unreadable", engine=self.name, reason=reason)
        work = tempfile.mkdtemp(prefix="sw-docread-")
        try:
            fd = os.open(os.path.join(work, INPUT_NAME), os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_BINARY", 0), 0o600)
            with os.fdopen(fd, "wb") as fh:
                fh.write(data)  # the checked bytes, not the stored file again (no check-then-use gap)
            child = run_limited(self.command(max_pages, tool), limits=self.limits, cwd=work,
                                env_extra={"HOME": work, "TMPDIR": work, "TEMP": work, "TMP": work})
        finally:
            shutil.rmtree(work, ignore_errors=True)
        return self._result(child, max_pages)

    def _result(self, child: ChildResult, max_pages: int) -> TextResult:
        if child.status == "unavailable":
            return TextResult(status="unavailable", reason="binary_missing")
        if child.status == "timeout":
            return TextResult(status="timeout", engine=self.name, reason="timeout")
        if child.status == "too_big":
            return TextResult(status="unreadable", engine=self.name, reason="output_too_large")
        if child.rc != 0:
            reason = {1: "malformed", 3: "encrypted", LIMITS_FAILED_RC: "limits_failed", 127: "binary_missing"}.get(child.rc)
            if reason is None:  # a signal (POSIX, negative) or an NTSTATUS such as a job quota kill (Windows, >= 0xC0000000)
                reason = "killed" if child.rc < 0 or child.rc >= 0xC0000000 else "exit_error"
            return TextResult(status="unreadable", engine=self.name, reason=reason)
        text = child.out.decode("utf-8", errors="replace")
        pages = text.count("\f") or (1 if text.strip() else 0)
        if pages > max_pages:
            return TextResult(status="too_many_pages", pages=pages, engine=self.name, reason="too_many_pages")
        if sum(1 for ch in text if not ch.isspace()) < MIN_TEXT_CHARS:
            return TextResult(status="no_text", pages=pages, engine=self.name, reason="no_text_layer")
        return TextResult(status="ok", text=text, pages=pages, engine=self.name)
