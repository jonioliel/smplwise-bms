"""CR-PDF-CHILD-2440 (review 04:F11): the report PDFs share one child entry (services/bill_pdf_engine.py: `render_html_weasyprint`,
`run_report_job`, `child_main`) and one parent launch (services/bill_pdf.run_report_child). Same command line, environment and limits."""
from __future__ import annotations

import io
import json
import logging
import subprocess
import sys

import pytest

from smplwise.services import bill_pdf, bill_pdf_engine, building_report_engine, building_report_pdf, temperature_pdf, temperature_pdf_engine

ENGINES = (building_report_engine, temperature_pdf_engine)
PARENTS = ((building_report_pdf, "smplwise.services.building_report_engine", "building report pdf"),
           (temperature_pdf, "smplwise.services.temperature_pdf_engine", "temperature pdf"))


# ---------------------------------------------------------------- the child: engine choice

def _job(engine=None, **kw):
    return {"html": "<p>x</p>", "model": {"m": 1}, **({"engine": engine} if engine else {}), **kw}


def test_report_job_prefers_weasyprint_and_passes_the_page_cap():
    seen = []
    out = bill_pdf_engine.run_report_job(_job(max_pages=7), lambda html, n: seen.append((html, n)) or b"W", lambda model, n: b"F")
    assert out == (b"W", "weasyprint") and seen == [("<p>x</p>", 7)]
    out = bill_pdf_engine.run_report_job(_job(), lambda html, n: seen.append(n) or b"W", lambda model, n: b"F")
    assert out == (b"W", "weasyprint") and seen[-1] == bill_pdf_engine.MAX_PAGES, "no cap in the job: the default"


def test_report_job_falls_back_to_fpdf2_only_in_auto(capsys):
    def broken(html, n):
        raise OSError("pango missing")

    seen = []
    assert bill_pdf_engine.run_report_job(_job("auto", max_pages=3), broken, lambda model, n: seen.append((model, n)) or b"F") == (b"F", "fpdf2")
    assert seen == [({"m": 1}, 3)] and "weasyprint failed (OSError); using fpdf2" in capsys.readouterr().err
    with pytest.raises(OSError):
        bill_pdf_engine.run_report_job(_job("weasyprint"), broken, lambda model, n: b"F")
    assert bill_pdf_engine.run_report_job(_job("fpdf2"), broken, lambda model, n: b"F") == (b"F", "fpdf2"), "fpdf2 asked: WeasyPrint is not tried"


def test_a_refusal_is_never_retried_on_the_other_engine():
    def refuse(html, n):
        raise bill_pdf_engine.RenderRefused("pdf_page_limit")

    called = []
    with pytest.raises(bill_pdf_engine.RenderRefused):
        bill_pdf_engine.run_report_job(_job("auto"), refuse, lambda model, n: called.append(1) or b"F")
    assert called == []


@pytest.mark.parametrize("eng", ENGINES)
def test_each_report_child_reads_its_own_two_renderers_at_each_job(eng, monkeypatch):
    assert eng.render_weasyprint is bill_pdf_engine.render_html_weasyprint
    monkeypatch.setattr(eng, "render_weasyprint", lambda html, n: b"%PDF-w")
    assert eng.run_job(_job()) == (b"%PDF-w", "weasyprint")

    def broken(html, n):
        raise RuntimeError("no")

    monkeypatch.setattr(eng, "render_weasyprint", broken)
    monkeypatch.setattr(eng, "render_fpdf2", lambda model, n: b"%PDF-f")
    assert eng.run_job(_job("auto")) == (b"%PDF-f", "fpdf2")


# ---------------------------------------------------------------- the child: its entry

class _Std:
    def __init__(self, data: bytes = b""):
        self.buffer = io.BytesIO(data)
        self.text: list[str] = []

    def write(self, s):
        self.text.append(s)

    def flush(self):
        pass


def _run_main(monkeypatch, main, job):
    stdin, stdout, stderr = _Std(json.dumps(job).encode()), _Std(), _Std()
    limits, denied = [], []
    monkeypatch.setattr(bill_pdf_engine, "deny_network", lambda: denied.append(1))
    monkeypatch.setattr(bill_pdf_engine, "apply_limits", lambda *a: limits.append(a))
    monkeypatch.setattr(sys, "stdin", stdin)
    monkeypatch.setattr(sys, "stdout", stdout)
    monkeypatch.setattr(sys, "stderr", stderr)
    rc = main()
    return rc, stdout.buffer.getvalue(), "".join(stderr.text), limits, denied


@pytest.mark.parametrize("eng", ENGINES)
def test_a_report_child_writes_the_pdf_and_names_its_engine(eng, monkeypatch):
    monkeypatch.setattr(eng, "run_job", lambda job: (b"%PDF-1.7 x", "weasyprint"))
    rc, out, err, limits, denied = _run_main(monkeypatch, eng.main, {"html": "", "model": {}, "memory_bytes": 1000, "cpu_seconds": 9, "fsize_bytes": 77})
    assert (rc, out, err) == (0, b"%PDF-1.7 x", "engine=weasyprint\n") and limits == [(1000, 9, 77)] and denied == [1]
    rc, _out, _err, limits, _d = _run_main(monkeypatch, eng.main, {"html": "", "model": {}})
    assert rc == 0 and limits == [], "no memory cap in the job: no limits call (as before)"
    rc, _out, _err, limits, _d = _run_main(monkeypatch, eng.main, {"html": "", "model": {}, "memory_bytes": 5})
    assert limits == [(5, 30, 12_000_000)], "the defaults for cpu seconds and file size"


@pytest.mark.parametrize("eng", ENGINES)
def test_a_report_child_exits_3_with_the_refusal_code(eng, monkeypatch):
    def refuse(job):
        raise bill_pdf_engine.RenderRefused("pdf_too_large")

    monkeypatch.setattr(eng, "run_job", refuse)
    stderr_lines = []
    monkeypatch.setattr("builtins.print", lambda *a, **k: stderr_lines.append((a, k.get("file") is sys.stderr)))
    rc, out, _err, _l, _d = _run_main(monkeypatch, eng.main, {"html": "", "model": {}})
    assert rc == 3 and out == b"" and stderr_lines and stderr_lines[0][0] == ("pdf_too_large",)


@pytest.mark.parametrize("eng", ENGINES)
def test_a_report_child_ignores_a_selfcheck_job(eng, monkeypatch):
    """Only the bill child answers `selfcheck`; a report child renders (as before this change)."""
    monkeypatch.setattr(eng, "run_job", lambda job: (b"%PDF-", "fpdf2"))
    rc, out, err, _l, _d = _run_main(monkeypatch, eng.main, {"selfcheck": True, "html": "", "model": {}})
    assert (rc, out, err) == (0, b"%PDF-", "engine=fpdf2\n")


def test_the_bill_child_still_answers_selfcheck_and_renders(monkeypatch):
    monkeypatch.setattr(bill_pdf_engine, "self_check", lambda engine: 40 if engine == "fpdf2" else 41)
    rc, _out, _err, _l, _d = _run_main(monkeypatch, bill_pdf_engine.main, {"selfcheck": True, "engine": "fpdf2"})
    assert rc == 40
    rc, _out, _err, _l, _d = _run_main(monkeypatch, bill_pdf_engine.main, {"selfcheck": True})
    assert rc == 41, "no engine in the job: auto"
    monkeypatch.setattr(bill_pdf_engine, "run_job", lambda job: (b"%PDF-bill", "fpdf2"))
    rc, out, err, limits, _d = _run_main(monkeypatch, bill_pdf_engine.main, {"snapshot": {}, "memory_bytes": 9})
    assert (rc, out, err) == (0, b"%PDF-bill", "engine=fpdf2\n") and limits == [(9, 30, 12_000_000)]


# ---------------------------------------------------------------- the parent launch

class _Proc:
    def __init__(self, rc=0, out=b"%PDF-1.7", err=b"engine=weasyprint\n", timeout=False):
        self.returncode, self._out, self._err, self._timeout = rc, out, err, timeout
        self.sent = None
        self.calls = 0
        self.pid = 4242

    def communicate(self, payload=None, timeout=None):
        self.calls += 1
        if self._timeout and self.calls == 1:
            raise subprocess.TimeoutExpired(cmd="x", timeout=timeout)
        self.sent = payload if payload is not None else self.sent
        return self._out, self._err

    def poll(self):
        return self.returncode


def _fake_popen(monkeypatch, proc=None, raises=None):
    seen = {}

    def popen(cmd, env=None, **kw):
        seen.update(cmd=cmd, env=env, kw=kw)
        if raises:
            raise raises
        return proc

    monkeypatch.setattr(subprocess, "Popen", popen)
    killed = []
    monkeypatch.setattr(bill_pdf, "_kill_group", lambda p: killed.append(p))
    return seen, killed


@pytest.mark.parametrize(("parent", "module", "what"), PARENTS)
def test_the_parent_starts_its_own_child_with_the_bill_process_model(parent, module, what, monkeypatch):
    proc = _Proc()
    seen, killed = _fake_popen(monkeypatch, proc)
    out, engine = parent._run({"html": "h", "model": {"a": 1}}, 12.5)
    assert (out, engine) == (b"%PDF-1.7", "weasyprint") and killed == []
    assert seen["cmd"] == [sys.executable, "-s", "-m", module], "the same command line as before"
    assert seen["env"] == bill_pdf.minimal_env(bill_pdf._child_extra()), "the scrubbed environment of the bill child"
    assert seen["kw"]["cwd"] == bill_pdf._PACKAGE_PARENT and seen["kw"]["stdin"] == seen["kw"]["stdout"] == seen["kw"]["stderr"] == subprocess.PIPE
    assert json.loads(proc.sent) == {"html": "h", "model": {"a": 1}}


@pytest.mark.parametrize(("parent", "module", "what"), PARENTS)
def test_the_parent_maps_the_childs_outcomes_to_its_own_error(parent, module, what, monkeypatch, caplog):
    def code_of(proc=None, raises=None):
        _fake_popen(monkeypatch, proc, raises)
        with pytest.raises(parent.PdfError) as exc:
            parent._run({}, 1.0)
        return exc.value.code

    with caplog.at_level(logging.ERROR):
        assert code_of(raises=OSError("no python")) == "pdf_unavailable"
        assert code_of(_Proc(rc=3, out=b"", err=b"pdf_too_large\n")) == "pdf_too_large"
        assert code_of(_Proc(rc=3, out=b"", err=b"pdf_page_limit\n")) == "pdf_page_limit"
        assert code_of(_Proc(rc=1, out=b"", err=b"Traceback ...")) == "pdf_unavailable"
        assert code_of(_Proc(rc=0, out=b"not a pdf", err=b"")) == "pdf_unavailable"
    texts = [r.getMessage() for r in caplog.records]
    assert any(t.startswith(f"{what}: cannot start the render process:") for t in texts)
    assert any(t.startswith(f"{what}: render failed (exit 1):") for t in texts), "the log lines keep each report's name"


@pytest.mark.parametrize(("parent", "module", "what"), PARENTS)
def test_a_timeout_kills_the_childs_group_and_is_its_own_code(parent, module, what, monkeypatch):
    proc = _Proc(timeout=True)
    _seen, killed = _fake_popen(monkeypatch, proc)
    with pytest.raises(parent.PdfError) as exc:
        parent._run({}, 0.5)
    assert exc.value.code == "pdf_timeout" and killed == [proc] and proc.calls == 2, "killed, then reaped"


def test_an_engine_line_missing_from_stderr_is_no_engine(monkeypatch):
    _fake_popen(monkeypatch, _Proc(err=b""))
    assert temperature_pdf._run({}, 1.0) == (b"%PDF-1.7", None)
