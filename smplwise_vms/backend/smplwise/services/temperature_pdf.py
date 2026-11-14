"""CR-INFRA-TEMPERATURE 2.9.1: the temperature report PDF in the isolated render child (services/temperature_pdf_engine.py), with the
bill PDF's process model and limits (scrubbed environment, own process group, timeout, memory / page / size caps; services/bill_pdf.py).

`render(model)` returns PDF bytes or raises PdfError(code): `pdf_unavailable` (no engine can start or render here), `pdf_timeout`,
`pdf_page_limit`, `pdf_too_large`. Tests replace the renderer with `set_renderer` (no engine is needed to test the routes)."""
from __future__ import annotations

import json
import logging
import os
import re
import subprocess
import sys
from typing import Any, Callable

from . import temperature_report as rep
from .bill_pdf import _PACKAGE_PARENT, _STDERR_KEEP, _child_extra, _kill_group, _limits
from .child_env import minimal_env

log = logging.getLogger("smplwise.temperature.pdf")


class PdfError(Exception):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


_RENDERER: Callable[[dict[str, Any]], bytes] | None = None


def set_renderer(fn: Callable[[dict[str, Any]], bytes] | None) -> None:
    """Tests: a fake renderer (None restores the real child process)."""
    global _RENDERER
    _RENDERER = fn


def render(model: dict[str, Any]) -> bytes:
    if _RENDERER is not None:
        return _RENDERER(model)
    limits = _limits(None, None)
    job = {"html": rep.html_of(model), "model": model, "engine": limits.engine, "max_pages": max(limits.max_pages, 120), "memory_bytes": limits.memory_bytes,
           "cpu_seconds": int(limits.timeout_s) + 5, "fsize_bytes": limits.max_pdf_bytes + 1_000_000}
    out, _engine = _run(job, limits.timeout_s)
    if len(out) > limits.max_pdf_bytes:
        raise PdfError("pdf_too_large")
    return out


def _run(job: dict[str, Any], timeout_s: float) -> tuple[bytes, str | None]:
    payload = json.dumps(job, default=str).encode("utf-8")
    kwargs: dict[str, Any] = {"stdin": subprocess.PIPE, "stdout": subprocess.PIPE, "stderr": subprocess.PIPE, "cwd": _PACKAGE_PARENT}
    if os.name == "posix":
        kwargs["start_new_session"] = True
    try:
        proc = subprocess.Popen([sys.executable, "-s", "-m", "smplwise.services.temperature_pdf_engine"], env=minimal_env(_child_extra()), **kwargs)
    except OSError as exc:
        log.error("temperature pdf: cannot start the render process: %s", exc)
        raise PdfError("pdf_unavailable") from exc
    try:
        out, err = proc.communicate(payload, timeout=timeout_s)
    except subprocess.TimeoutExpired:
        _kill_group(proc)
        proc.communicate()
        raise PdfError("pdf_timeout") from None
    finally:
        if proc.poll() is None:
            _kill_group(proc)
    tail = err.decode("utf-8", "replace")[-_STDERR_KEEP:].strip()
    if proc.returncode == 3:
        raise PdfError("pdf_too_large" if "pdf_too_large" in tail else "pdf_page_limit")
    if proc.returncode != 0 or not out.startswith(b"%PDF-"):
        log.error("temperature pdf: render failed (exit %s): %s", proc.returncode, tail[-400:])
        raise PdfError("pdf_unavailable")
    m = re.search(r"engine=(weasyprint|fpdf2)", tail)
    return out, (m.group(1) if m else None)
