"""CR-INSIGHT215 part 1: the monthly building report PDF in an isolated render child (services/building_report_engine.py), with the bill
PDF's process model and limits (scrubbed environment, own process group, timeout, memory / page / size caps; services/bill_pdf.py) - the same
shape as services/temperature_pdf.py.

`render(model)` returns PDF bytes or raises PdfError(code): `pdf_unavailable`, `pdf_timeout`, `pdf_page_limit`, `pdf_too_large`. Tests may
replace the renderer with `set_renderer`; the real-render test drives the child itself."""
from __future__ import annotations

import json
import logging
import os
import re
import subprocess
import sys
from typing import Any, Callable

from . import building_report as rep
from .bill_pdf import _PACKAGE_PARENT, _STDERR_KEEP, _child_extra, _kill_group, _limits
from .child_env import minimal_env

log = logging.getLogger("smplwise.insights.pdf")
MAX_PAGES = 40


class PdfError(Exception):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


_RENDERER: Callable[[dict[str, Any]], bytes] | None = None
LAST_ENGINE: dict[str, str | None] = {"engine": None}


def set_renderer(fn: Callable[[dict[str, Any]], bytes] | None) -> None:
    global _RENDERER
    _RENDERER = fn


def render(model: dict[str, Any], engine: str | None = None) -> bytes:
    if _RENDERER is not None:
        return _RENDERER(model)
    limits = _limits(None, engine)
    job = {"html": rep.html_of(model), "model": model, "engine": limits.engine, "max_pages": MAX_PAGES, "memory_bytes": limits.memory_bytes,
           "cpu_seconds": int(limits.timeout_s) + 5, "fsize_bytes": limits.max_pdf_bytes + 1_000_000}
    out, used = _run(job, limits.timeout_s)
    LAST_ENGINE["engine"] = used
    if len(out) > limits.max_pdf_bytes:
        raise PdfError("pdf_too_large")
    return out


def _run(job: dict[str, Any], timeout_s: float) -> tuple[bytes, str | None]:
    payload = json.dumps(job, default=str).encode("utf-8")
    kwargs: dict[str, Any] = {"stdin": subprocess.PIPE, "stdout": subprocess.PIPE, "stderr": subprocess.PIPE, "cwd": _PACKAGE_PARENT}
    if os.name == "posix":
        kwargs["start_new_session"] = True
    try:
        proc = subprocess.Popen([sys.executable, "-s", "-m", "smplwise.services.building_report_engine"], env=minimal_env(_child_extra()), **kwargs)
    except OSError as exc:
        log.error("building report pdf: cannot start the render process: %s", exc)
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
        log.error("building report pdf: render failed (exit %s): %s", proc.returncode, tail[-400:])
        raise PdfError("pdf_unavailable")
    m = re.search(r"engine=(weasyprint|fpdf2)", tail)
    return out, (m.group(1) if m else None)
