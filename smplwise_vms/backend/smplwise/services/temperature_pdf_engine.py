"""CR-INFRA-TEMPERATURE 2.9.1: the render child of the temperature report PDF. It runs exactly like the bill PDF child
(services/bill_pdf_engine.py, whose fetcher, limits and network lock it reuses): one JSON job on stdin, the PDF on stdout, no network.

Primary engine: WeasyPrint over the report HTML (services/temperature_report.html_of, built in the parent; bundled fonts only).
Fallback engine: fpdf2 - the same numbers and event lists as plain text tables (no chart), used when WeasyPrint / Pango cannot load."""
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
    """The plain fallback: per unit a page with the title, range, band, the statistics, the events and the signature line."""
    from fpdf import FPDF

    from zoneinfo import ZoneInfo

    from .temperature_report import LABELS, _local, deg, dur_text, event_text, flag_text, range_text, samples_note

    lang = model.get("lang") or "he"
    L = LABELS[lang]
    rtl = lang == "he"
    pdf = FPDF(format="A4")
    pdf.set_creator("SmplWise Arx")
    pdf.add_font("HeeboHe", fname=str(FONT_DIR / "Heebo-he-400.ttf"))
    pdf.add_font("HeeboLa", fname=str(FONT_DIR / "Heebo-la-400.ttf"))
    pdf.set_fallback_fonts(["HeeboLa"])
    pdf.set_margins(14, 14, 14)
    pdf.set_auto_page_break(True, margin=18)
    align = "R" if rtl else "L"
    if rtl:
        pdf.set_text_shaping(use_shaping_engine=True, direction="rtl", script="hebr", language="heb")

    def line(text: str, size: float = 10) -> None:
        pdf.set_font("HeeboHe" if rtl else "HeeboLa", size=size)
        pdf.multi_cell(0, size * 0.55, text, align=align, new_x="LMARGIN", new_y="NEXT")

    for u in model["units"]:
        pdf.add_page()
        s = u["stats"]
        line(f'{L["haccp"] if model.get("layout") == "haccp" else L["title"]} · {u["name"]}', 15)
        line(f'{L["range"]}: {range_text(model)}', 9)
        line(f'{L["sensor"]}: {u.get("sensor") or "—"} · {L["door"]}: {u.get("door") or L["none"]} · {L["band"]}: {deg(u["low"])} – {deg(u["high"])}', 9)
        if not u.get("has_data", True):
            line(f'{L["no_data_range"]} · {range_text(model)}', 10)
        pdf.ln(2)
        line(f'{L["min"]} {deg(s["min"])} · {L["max"]} {deg(s["max"])} · {L["avg"]} {deg(s["avg"])} · {L["out"]} {dur_text(s["out_min"], lang)} · '
             f'{L["alerts"]} {s["alarms"] + s["warnings"]}', 10)
        if u.get("daily"):  # phase 3: the HACCP daily table, one line per day
            pdf.ln(2)
            line(L["daily"], 11)
            for d in u["daily"]:
                line(f'{d["day"]} · {deg(d["min"])} / {deg(d["max"])} / {deg(d["avg"])} · {L["out"]} {dur_text(d["out_min"], lang) if d["out_min"] else 0} · {L["alerts"]} {d["alarms"]} · '
                     f'{d["coverage"]:.0f}% · {L["v_" + d["verdict"]]}', 8.5)
        if model.get("events"):
            pdf.ln(2)
            line(L["events"], 11)
            for e in u.get("events") or []:
                line(f'{e["started_at"][:16].replace("T", " ")} UTC · {event_text(e, lang)} · {L["sev_" + e["severity"]]}', 8.5)
        if model.get("samples") and u.get("samples") is not None:  # TEMPREP-295: the list of every sample, one line each
            sm = u["samples"]
            pdf.ln(2)
            line(f'{L["samples"]} · {sm["total"]}', 11)
            tz = ZoneInfo(model["zone"])
            for ts, v, f in sm["rows"]:
                line(f'{_local(ts, tz):%d.%m.%Y %H:%M} · {deg(v)[:-1]} °C · {flag_text(f, lang)}'.rstrip(" ·"), 7.5)
            if sm["capped"]:
                line(samples_note(sm, lang), 8)
            elif not sm["rows"]:
                line(L["no_samples"], 8)
        if model.get("signature"):
            pdf.ln(10)
            line(f'{L["sign"]}: ____________________    {L["date"]}: ____________', 10)
        pdf.set_y(-16)
        line(f'{L["digest"]} sha256 {model.get("digest", "")[:16]} · {model.get("zone", "")}', 7)
        if pdf.page_no() > max_pages:
            raise RenderRefused("pdf_page_limit")
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
