"""CR-INSIGHT215 part 1: the monthly building report PDF in an isolated render child (services/building_report_engine.py), with the bill
PDF's process model and limits (scrubbed environment, own process group, timeout, memory / page / size caps; services/bill_pdf.py) - the same
shape as services/temperature_pdf.py.

`render(model)` returns PDF bytes or raises PdfError(code): `pdf_unavailable`, `pdf_timeout`, `pdf_page_limit`, `pdf_too_large`. Tests may
replace the renderer with `set_renderer`; the real-render test drives the child itself."""
from __future__ import annotations

import logging
from typing import Any, Callable

from . import building_report as rep
from .bill_pdf import _limits, run_report_child

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
    return run_report_child(job, timeout_s, module="smplwise.services.building_report_engine", what="building report pdf", error=PdfError, logger=log)
