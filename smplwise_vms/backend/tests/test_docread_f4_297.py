"""Security review SUPPLIERDOCS2-297, finding F4 (docs/changes/CR-SUPPLIERDOCS-297.md): the `pdftotext` child that parses a supplier's
PDF runs under hard limits and never sees a user-controlled path, and every failure degrades to "no text extracted" with an audit row.

The "binary" in most tests is a FAKE: a small Python script run by the base interpreter (on Windows a venv's python.exe is a launcher that
starts a second process, which the reader's Job Object refuses on purpose). The fake echoes what it received (argv, working directory,
environment, the files it can see) or misbehaves (hangs, floods stdout, spawns a grandchild, exits 1 / 3). One test runs the real
`pdftotext` when it is installed (skipped otherwise). The POSIX rlimit test runs on Linux only and the Job Object test on Windows only:
each is reported as skipped on the other OS, never as passed."""
from __future__ import annotations

import json
import os
import shutil
import sys
import time
from pathlib import Path

import pytest
from test_docread_297 import _text_pdf, doc_with_file, on, read
from test_maintenance_215 import mw  # noqa: F401  (the fixture)

from smplwise.services.docread import ports
from smplwise.services.docread import pdftext
from smplwise.services.docread import service as dsvc

PY = getattr(sys, "_base_executable", None) or sys.executable
CERT = _text_pdf(["Certificate number POL-2026-0042", "Valid until 31/01/2028"])
EXPECTED_ARGS = ["-layout", "-enc", "UTF-8", "-q", "-f", "1", "-l", "11", "--", "in.pdf", "-"]

ECHO = """import json, os, sys
sys.stdout.write(json.dumps({"argv": sys.argv[1:], "cwd": os.getcwd(), "env": sorted(os.environ), "home": os.environ.get("HOME"),
                             "files": sorted(os.listdir("."))}) + "\\n\\f")
"""


def fake_tool(tmp_path: Path, body: str, name: str = "fake") -> list[str]:
    d = tmp_path / "fakebin"
    d.mkdir(exist_ok=True)
    script = d / f"{name}.py"
    script.write_text(body, encoding="utf-8")
    return [PY, "-I", "-S", str(script)]


def cert_file(tmp_path: Path, name: str = "cert.pdf", data: bytes = CERT) -> Path:
    p = tmp_path / "upload" / name
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(data)
    return p


def no_child(monkeypatch) -> list:
    calls: list = []

    def refuse(*a, **k):
        calls.append(a)
        raise AssertionError("the tool must not be started for a refused file")

    monkeypatch.setattr(pdftext, "run_limited", refuse)
    return calls


# ================================================================ limits are passed

def test_the_limits_and_the_fixed_argument_list_are_passed_to_the_child(monkeypatch, tmp_path):
    seen: dict = {}
    real = pdftext.run_limited

    def spy(cmd, *, limits, cwd=None, env_extra=None):
        seen.update(cmd=list(cmd), limits=limits, cwd=str(cwd), env=pdftext.minimal_env(env_extra), files=sorted(os.listdir(cwd)))
        return real(cmd, limits=limits, cwd=cwd, env_extra=env_extra)

    monkeypatch.setattr(pdftext, "run_limited", spy)
    monkeypatch.setenv("SUPERVISOR_TOKEN", "secret-token-for-test")
    monkeypatch.setenv("HTTPS_PROXY", "http://proxy.invalid:3128")
    reader = pdftext.PdftotextReader(tool=fake_tool(tmp_path, ECHO))
    res = reader.read(cert_file(tmp_path), max_pages=10)
    assert res.status == "ok", res
    lim = seen["limits"]
    assert (lim.timeout_s, lim.cpu_s, lim.memory_bytes, lim.output_bytes) == (20, 20, pdftext.MEMORY_MAX, pdftext.OUTPUT_MAX)
    assert (lim.file_size, lim.processes, lim.open_files) == (0, 0, pdftext.OPEN_FILES_MAX)
    assert seen["cmd"][-len(EXPECTED_ARGS):] == EXPECTED_ARGS
    assert seen["files"] == ["in.pdf"] and Path(seen["cwd"]).name.startswith("sw-docread-")
    assert not Path(seen["cwd"]).exists(), "the private working directory is removed afterwards"
    assert "SUPERVISOR_TOKEN" not in seen["env"] and "HTTPS_PROXY" not in seen["env"]
    assert seen["env"]["HOME"] == seen["cwd"] and seen["env"]["TMPDIR"] == seen["cwd"]
    # the POSIX trampoline carries exactly these limits as one JSON argument (never through a shell)
    argv = pdftext.posix_argv(["/usr/bin/pdftotext", *EXPECTED_ARGS], lim)
    assert argv[:5] == [sys.executable, "-I", "-S", "-c", pdftext.TRAMPOLINE]
    assert json.loads(argv[5]) == {"as": pdftext.MEMORY_MAX, "cpu": 20, "fsize": 0, "nofile": 32, "nproc": 0, "core": 0}
    assert argv[6:] == ["/usr/bin/pdftotext", *EXPECTED_ARGS]
    # the timeout is clamped
    assert pdftext.PdftotextReader(timeout_s=999).limits.timeout_s == 30 and pdftext.PdftotextReader(timeout_s=0).limits.cpu_s == 1


@pytest.mark.skipif(os.name != "posix", reason="POSIX rlimits / sessions: Linux runner and add-on only")
def test_posix_the_child_really_runs_under_the_rlimits_in_its_own_session(tmp_path):
    body = """import json, os, resource, sys
names = ("RLIMIT_AS", "RLIMIT_CPU", "RLIMIT_FSIZE", "RLIMIT_NOFILE", "RLIMIT_CORE", "RLIMIT_NPROC")
r = {n: list(resource.getrlimit(getattr(resource, n))) for n in names}
r["own_session"] = os.getsid(0) == os.getpid()
sys.stdout.write(json.dumps(r) + "\\n\\f")
"""
    res = pdftext.PdftotextReader(tool=fake_tool(tmp_path, body)).read(cert_file(tmp_path), max_pages=10)
    assert res.status == "ok", res
    got = json.loads(res.text.split("\n", 1)[0])
    assert got["RLIMIT_AS"][0] <= pdftext.MEMORY_MAX and got["RLIMIT_AS"][1] <= pdftext.MEMORY_MAX
    assert got["RLIMIT_CPU"][0] <= 20 and got["RLIMIT_CPU"][1] <= 21
    assert got["RLIMIT_FSIZE"] == [0, 0] and got["RLIMIT_NOFILE"][1] <= 32 and got["RLIMIT_CORE"] == [0, 0]
    assert got["own_session"] is True
    assert pdftext.enforcement()["os"] == "posix" and "rlimit_as" in pdftext.enforcement()["enforced"]


@pytest.mark.skipif(os.name != "nt", reason="Windows Job Object: developer workstation only")
def test_windows_the_child_is_held_by_a_job_object_that_allows_no_second_process(tmp_path):
    body = """import ctypes, json, subprocess, sys
from ctypes import wintypes as w
k = ctypes.WinDLL("kernel32"); k.GetCurrentProcess.restype = w.HANDLE
k.IsProcessInJob.argtypes = (w.HANDLE, w.HANDLE, ctypes.POINTER(w.BOOL))
b = w.BOOL(); k.IsProcessInJob(k.GetCurrentProcess(), None, ctypes.byref(b))
try:
    subprocess.run([sys.executable, "-c", "pass"], timeout=10); spawned = True
except OSError:
    spawned = False
try:
    x = bytearray(900 * 1024 * 1024); big = True
except MemoryError:
    big = False
sys.stdout.write(json.dumps({"in_job": bool(b.value), "spawned": spawned, "big_alloc": big}) + "\\n\\f")
"""
    res = pdftext.PdftotextReader(tool=fake_tool(tmp_path, body)).read(cert_file(tmp_path), max_pages=10)
    assert res.status == "ok", res
    assert json.loads(res.text.split("\n", 1)[0]) == {"in_job": True, "spawned": False, "big_alloc": False}
    child = pdftext.run_limited(fake_tool(tmp_path, "print('x')", "plain"), limits=pdftext.Limits())
    assert "job_cpu_time" in child.enforced and "job_one_process" in child.enforced
    assert "file-size limit" in pdftext.enforcement()["not_enforced"]


# ================================================================ oversized output, page count

def test_an_oversized_output_is_cut_at_the_cap_and_the_child_killed(tmp_path):
    body = "import sys\nwhile True: sys.stdout.write('a' * 65536)\n"
    t0 = time.monotonic()
    res = pdftext.PdftotextReader(tool=fake_tool(tmp_path, body)).read(cert_file(tmp_path), max_pages=10)
    assert (res.status, res.reason, res.text) == ("unreadable", "output_too_large", "")
    assert time.monotonic() - t0 < 15, "killed at the cap, long before the timeout"


def test_a_huge_declared_page_count_is_refused_before_the_tool_starts(monkeypatch, tmp_path):
    calls = no_child(monkeypatch)
    reader = pdftext.PdftotextReader(tool=fake_tool(tmp_path, ECHO))
    huge = CERT.replace(b"/Count 1", b"/Count 100000")
    res = reader.read(cert_file(tmp_path, data=huge), max_pages=10)
    assert (res.status, res.pages, res.reason) == ("too_many_pages", 100000, "too_many_pages")
    leaves = b"%PDF-1.4\n" + b"".join(b"%d 0 obj\n<< /Type /Page >>\nendobj\n" % i for i in range(1, 51)) + b"%%EOF\n"
    res = reader.read(cert_file(tmp_path, "leaves.pdf", leaves), max_pages=10)
    assert (res.status, res.pages) == ("too_many_pages", 50)
    assert calls == []
    assert pdftext.precheck(CERT, 10) == ("", 1)


def test_more_pages_than_the_cap_in_the_output_are_refused(tmp_path):
    body = "import sys\nsys.stdout.write('page text here\\f' * 12)\n"
    res = pdftext.PdftotextReader(tool=fake_tool(tmp_path, body)).read(cert_file(tmp_path), max_pages=10)
    assert (res.status, res.pages, res.text) == ("too_many_pages", 12, "")


# ================================================================ a hanging tool, the whole tree killed

def test_a_hanging_tool_is_killed_at_the_deadline(tmp_path):
    t0 = time.monotonic()
    res = pdftext.PdftotextReader(timeout_s=1, tool=fake_tool(tmp_path, "import time\ntime.sleep(60)\n")).read(cert_file(tmp_path), max_pages=10)
    assert (res.status, res.reason) == ("timeout", "timeout")
    assert time.monotonic() - t0 < 10


def test_the_whole_process_tree_dies_at_the_deadline(tmp_path):
    """The fake starts a grandchild that appends to a heartbeat file, then hangs. After the deadline nothing of the tree may still
    write. (Windows: the Job Object already refuses the grandchild; POSIX: the process group is killed.)"""
    hb = tmp_path / "heartbeat.txt"
    body = """import subprocess, sys, time
HB = "import sys, time\\nwhile True:\\n    open(sys.argv[1], 'a').write('x')\\n    time.sleep(0.05)\\n"
try:
    subprocess.Popen([sys.executable, "-I", "-S", "-c", HB, sys.argv[1]], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
except OSError:
    pass
time.sleep(60)
"""
    # a file-size and process allowance only for this probe (the reader itself uses FSIZE 0 / NPROC 0)
    limits = pdftext.Limits(timeout_s=2, cpu_s=5, file_size=1 << 20, processes=1 << 20)
    child = pdftext.run_limited([*fake_tool(tmp_path, body), str(hb)], limits=limits)
    assert child.status == "timeout"
    size = hb.stat().st_size if hb.exists() else 0
    if os.name == "posix":
        assert size > 0, "the grandchild did start (otherwise this test proves nothing)"
    time.sleep(0.8)
    assert (hb.stat().st_size if hb.exists() else 0) == size, "a grandchild survived the kill"


# ================================================================ malicious file names

@pytest.mark.parametrize("name", ["-layout.pdf", "--help.pdf", "-opw secret.pdf", "a;rm -rf ~.pdf", "$(id).pdf", "`id`.pdf",
                                  "x' -upw 'y.pdf", "-", "שם עברי.pdf"])
def test_a_malicious_file_name_never_reaches_the_tool(monkeypatch, tmp_path, name):
    monkeypatch.setenv("SUPERVISOR_TOKEN", "secret-token-for-test")
    p = tmp_path / "-l 99" / name
    p.parent.mkdir(parents=True)
    p.write_bytes(CERT)
    res = pdftext.PdftotextReader(tool=fake_tool(tmp_path, ECHO)).read(p, max_pages=10)
    assert res.status == "ok", res
    got = json.loads(res.text.split("\n", 1)[0])
    assert got["argv"] == EXPECTED_ARGS
    assert got["files"] == ["in.pdf"] and Path(got["cwd"]).resolve() != p.parent.resolve()
    assert "-l 99" not in res.text and (len(name) < 3 or name not in res.text)  # "-" is also the tool's stdout argument
    assert "SUPERVISOR_TOKEN" not in got["env"]


# ================================================================ missing binary, encrypted / malformed / oversized files

def test_a_missing_binary_is_unavailable_and_never_raises(monkeypatch, tmp_path):
    monkeypatch.setattr(pdftext.shutil, "which", lambda name: None)
    assert pdftext.PdftotextReader().read(cert_file(tmp_path), max_pages=10) == ports.TextResult(status="unavailable", reason="binary_missing")
    gone = pdftext.PdftotextReader(tool=[str(tmp_path / "no-such-pdftotext")]).read(cert_file(tmp_path), max_pages=10)
    assert (gone.status, gone.reason) == ("unavailable", "binary_missing")
    assert pdftext.run_limited([str(tmp_path / "no-such-tool")], limits=pdftext.Limits()).status == "unavailable"


def test_an_encrypted_pdf_is_refused_cleanly(monkeypatch, tmp_path):
    enc = CERT.replace(b"/Root 1 0 R", b"/Root 1 0 R /Encrypt 6 0 R")
    calls = no_child(monkeypatch)
    res = pdftext.PdftotextReader(tool=fake_tool(tmp_path, ECHO)).read(cert_file(tmp_path, data=enc), max_pages=10)
    assert (res.status, res.reason, res.text) == ("unreadable", "encrypted", "") and calls == []
    monkeypatch.undo()
    # the tool's own verdict (exit 3 = permission / password) maps the same way; exit 1 = cannot open = malformed
    res = pdftext.PdftotextReader(tool=fake_tool(tmp_path, "import sys\nsys.exit(3)\n", "enc")).read(cert_file(tmp_path), max_pages=10)
    assert (res.status, res.reason) == ("unreadable", "encrypted")
    res = pdftext.PdftotextReader(tool=fake_tool(tmp_path, "import sys\nsys.exit(1)\n", "bad")).read(cert_file(tmp_path), max_pages=10)
    assert (res.status, res.reason) == ("unreadable", "malformed")


def test_malformed_and_oversized_files_never_reach_the_tool(monkeypatch, tmp_path):
    calls = no_child(monkeypatch)
    reader = pdftext.PdftotextReader(tool=fake_tool(tmp_path, ECHO))
    assert reader.read(cert_file(tmp_path, "a.pdf", b"MZ\x90\x00 not a pdf"), max_pages=10).reason == "malformed"
    assert reader.read(cert_file(tmp_path, "b.pdf", b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\n"), max_pages=10).reason == "malformed"
    big = tmp_path / "upload" / "big.pdf"
    with big.open("wb") as fh:
        fh.write(b"%PDF-1.4\n")
        fh.truncate(pdftext.INPUT_MAX_BYTES + 1)
    res = reader.read(big, max_pages=10)
    assert (res.status, res.reason) == ("unreadable", "file_too_large")
    assert calls == []


def test_a_reader_crash_is_a_result_never_an_exception(monkeypatch, tmp_path):
    def boom(*a, **k):
        raise RuntimeError("unexpected")

    monkeypatch.setattr(pdftext, "run_limited", boom)
    res = pdftext.PdftotextReader(tool=fake_tool(tmp_path, ECHO)).read(cert_file(tmp_path), max_pages=10)
    assert (res.status, res.reason) == ("unreadable", "reader_error")

    class Exploding:
        name = "exploding"

        def read(self, path, *, max_pages):
            raise MemoryError("boom")

    dsvc.set_text_reader(Exploding())
    try:
        assert dsvc.run_reader("pdf", cert_file(tmp_path)).status == "unreadable"
    finally:
        dsvc.set_text_reader(None)


# ================================================================ end to end: degrade to "no text extracted" with an audit row

def test_a_limit_hit_degrades_to_a_failed_read_with_an_audit_reason(mw, tmp_path):
    on(mw)
    t, f = doc_with_file(mw)
    dsvc.set_text_reader(pdftext.PdftotextReader(timeout_s=1, tool=fake_tool(tmp_path, "import time\ntime.sleep(60)\n", "hang")))
    try:
        r = read(mw, t, f)
    finally:
        dsvc.set_text_reader(None)
    assert r.status_code == 201, r.text
    x = r.json()
    assert (x["state"], x["error_code"]) == ("failed", "timeout")
    assert all(v["proposed"] is None for v in x["fields"].values()) if x["fields"] else True
    details = [json.loads(a["details_json"]) for a in mw.audits("docread.read", "allowed")]
    assert details and details[-1]["reason"] == "timeout" and details[-1]["state"] == "failed"
    # the stored file and the task are unchanged; the next read after a discard is allowed
    assert mw.rows("SELECT COUNT(*) FROM doc_extractions WHERE state = 'failed'")[0][0] == 1


@pytest.mark.skipif(shutil.which("pdftotext") is None, reason="pdftotext (poppler-utils) not installed on this machine")
def test_the_real_pdftotext_under_the_limits_reads_a_file_with_a_hostile_name(tmp_path):
    res = pdftext.PdftotextReader().read(cert_file(tmp_path, "--help -l 99.pdf"), max_pages=10)
    assert res.status == "ok", res
    assert "POL-2026-0042" in res.text and res.pages == 1
