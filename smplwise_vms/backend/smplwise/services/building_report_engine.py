"""CR-INSIGHT215 part 1: the render child of the monthly building report PDF - exactly like the temperature report child
(services/temperature_pdf_engine.py, whose fetcher, limits and network lock come from services/bill_pdf_engine.py): one JSON job on stdin, the
PDF on stdout, no network.

Primary engine: WeasyPrint over the report HTML (services/building_report.html_of, built in the parent; bundled fonts only).
Fallback engine: fpdf2 - the same numbers as plain text lines (services/building_report.plain_lines), used when WeasyPrint / Pango cannot load."""
from __future__ import annotations

import json
import os
import sys
from typing import Any

from .bill_pdf_engine import FONT_DIR, MAX_PAGES, MAX_PDF_BYTES, LockedFetcher, RenderRefused, apply_limits, deny_network


def render_weasyprint(page_html: str, max_pages: int = MAX_PAGES) -> bytes:
    import logging

    from weasyprint import HTML

    logging.getLogger("weasyprint").setLevel(logging.ERROR)
    doc = HTML(string=page_html, base_url=None, url_fetcher=LockedFetcher(None)).render()
    if len(doc.pages) > max_pages:
        raise RenderRefused("pdf_page_limit")
    pdf = doc.write_pdf()
    if len(pdf) > MAX_PDF_BYTES:
        raise RenderRefused("pdf_too_large")
    return pdf


def render_fpdf2(model: dict[str, Any], max_pages: int = MAX_PAGES) -> bytes:
    from fpdf import FPDF

    from .building_report import LABELS, plain_lines

    lang = model.get("lang") or "he"
    rtl = lang == "he"
    pdf = FPDF(format="A4")
    pdf.set_creator("SmplWise Arx")
    pdf.add_font("HeeboHe", fname=str(FONT_DIR / "Heebo-he-400.ttf"))
    pdf.add_font("HeeboLa", fname=str(FONT_DIR / "Heebo-la-400.ttf"))
    pdf.set_fallback_fonts(["HeeboLa"])
    pdf.set_margins(14, 14, 14)
    pdf.set_auto_page_break(True, margin=18)
    if rtl:
        pdf.set_text_shaping(use_shaping_engine=True, direction="rtl", script="hebr", language="heb")
    pdf.add_page()
    for text, size in plain_lines(model):
        pdf.set_font("HeeboHe" if rtl else "HeeboLa", size=size)
        pdf.multi_cell(0, size * 0.6, text, align="R" if rtl else "L", new_x="LMARGIN", new_y="NEXT")
        if pdf.page_no() > max_pages:
            raise RenderRefused("pdf_page_limit")
    pdf.set_font("HeeboHe" if rtl else "HeeboLa", size=7)
    pdf.multi_cell(0, 4, f'{LABELS[lang]["digest"]}: sha256 {model.get("digest", "")[:16]} · {model.get("zone", "")}', align="R" if rtl else "L",
                   new_x="LMARGIN", new_y="NEXT")
    out = pdf.output()
    data = bytes(out) if not isinstance(out, bytes) else out
    if len(data) > MAX_PDF_BYTES:
        raise RenderRefused("pdf_too_large")
    return data


def run_job(job: dict[str, Any]) -> tuple[bytes, str]:
    engine = job.get("engine") or "auto"
    max_pages = int(job.get("max_pages") or MAX_PAGES)
    if engine in ("auto", "weasyprint"):
        try:
            return render_weasyprint(job["html"], max_pages), "weasyprint"
        except RenderRefused:
            raise
        except Exception as exc:
            if engine == "weasyprint":
                raise
            print(f"weasyprint failed ({type(exc).__name__}); using fpdf2", file=sys.stderr)
    return render_fpdf2(job["model"], max_pages), "fpdf2"


def main() -> int:
    deny_network()
    job = json.loads(sys.stdin.buffer.read())
    if job.get("memory_bytes"):
        apply_limits(int(job["memory_bytes"]), int(job.get("cpu_seconds") or 30), int(job.get("fsize_bytes") or 12_000_000))
    try:
        pdf, engine = run_job(job)
    except RenderRefused as exc:
        print(exc.code, file=sys.stderr)
        return 3
    sys.stderr.write(f"engine={engine}\n")
    sys.stdout.buffer.write(pdf)
    sys.stdout.buffer.flush()
    return 0


if __name__ == "__main__":
    os.environ.setdefault("HOME", "/tmp")
    raise SystemExit(main())
