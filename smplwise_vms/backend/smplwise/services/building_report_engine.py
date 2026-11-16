"""CR-INSIGHT215 part 1: the render child of the monthly building report PDF - exactly like the temperature report child
(services/temperature_pdf_engine.py, whose fetcher, limits and network lock come from services/bill_pdf_engine.py): one JSON job on stdin, the
PDF on stdout, no network.

Primary engine: WeasyPrint over the report HTML (services/building_report.html_of, built in the parent; bundled fonts only).
Fallback engine: fpdf2 - the same numbers as plain text lines (services/building_report.plain_lines), used when WeasyPrint / Pango cannot load."""
from __future__ import annotations

import os
from typing import Any

from .bill_pdf_engine import FONT_DIR, MAX_PAGES, MAX_PDF_BYTES, RenderRefused, child_main, render_html_weasyprint, run_report_job


render_weasyprint = render_html_weasyprint  # CR-PDF-CHILD: the shared WeasyPrint step, under the name this module always had


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
    return run_report_job(job, render_weasyprint, render_fpdf2)  # the two names are read here, at each job


def main() -> int:
    return child_main(run_job)


if __name__ == "__main__":
    os.environ.setdefault("HOME", "/tmp")
    raise SystemExit(main())
