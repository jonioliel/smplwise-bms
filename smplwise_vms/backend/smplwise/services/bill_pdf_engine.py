"""Render engines of the bill PDF (CR-023 P3). Runs inside the isolated render subprocess (see bill_pdf.py).

Primary engine: WeasyPrint with a *closed* URL fetcher. Fallback engine: fpdf2 with HarfBuzz shaping (plain layout).
`python -m smplwise.services.bill_pdf_engine` reads one JSON job on stdin and writes the PDF on stdout; nothing else
is read or written, and the process has no network use at all: the fetcher below is the only thing WeasyPrint can
ask for resources, and it knows exactly five names (four bundled font files and the re-encoded logo).
"""
from __future__ import annotations

import base64
import json
import os
import sys
from pathlib import Path
from typing import Any

from .bill_pdf_html import (ASSET_SCHEME, FONT_FILES, LOGO_URL, STATE_MARKS, build_html, chart_series, dmy, kwh, moment,
                            money, price, reading)
from .bill_pdf_model import BillSnapshot

ASSET_DIR = Path(__file__).resolve().parent.parent / "assets" / "bill"
FONT_DIR = ASSET_DIR / "fonts"

MAX_PAGES = 40
MAX_PDF_BYTES = 10 * 1024 * 1024


class RenderRefused(Exception):
    """A hard limit was hit (pages, size); the fallback engine must not be tried for these."""

    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


# ---------------------------------------------------------------------------------------------------- WeasyPrint
class LockedFetcher:
    """Resolves only the bundled fonts and the sanitised logo. Everything else (http, https, file, data, ftp,
    relative paths, redirects) is refused and recorded in `blocked`. It deliberately does not derive from WeasyPrint's
    URLFetcher, so no urllib opener, proxy handler or socket code exists in this object at all."""

    _fail_on_errors = False  # read by weasyprint.urls.fetch: a refused URL is a warning-level miss, not a crash

    def __init__(self, logo_png: bytes | None):
        self.logo_png = logo_png
        self.blocked: list[str] = []

    def fetch(self, url: str, headers: Any = None):  # signature of weasyprint.urls.URLFetcher.fetch
        from weasyprint.urls import URLFetcherResponse

        if url.startswith(ASSET_SCHEME):
            name = url[len(ASSET_SCHEME):]
            if name in FONT_FILES:  # exact allow-list, no path syntax can pass
                return URLFetcherResponse(url, (FONT_DIR / name).read_bytes(), {"Content-Type": "font/ttf"})
        elif url == LOGO_URL and self.logo_png:
            return URLFetcherResponse(url, self.logo_png, {"Content-Type": "image/png"})
        self.blocked.append(url[:200])
        raise ValueError("blocked by the bill renderer")

    def __call__(self, url: str, headers: Any = None):
        return self.fetch(url, headers)


def render_weasyprint(s: BillSnapshot, logo_png: bytes | None, max_pages: int = MAX_PAGES) -> bytes:
    import logging

    from weasyprint import HTML

    logging.getLogger("weasyprint").setLevel(logging.ERROR)  # the log would repeat user strings; keep it quiet
    fetcher = LockedFetcher(logo_png)
    doc = HTML(string=build_html(s, bool(logo_png)), base_url=None, url_fetcher=fetcher).render()
    if len(doc.pages) > max_pages:
        raise RenderRefused("pdf_page_limit")
    pdf = doc.write_pdf()
    if len(pdf) > MAX_PDF_BYTES:
        raise RenderRefused("pdf_too_large")
    return pdf


# ---------------------------------------------------------------------------------------------------- fpdf2
def render_fpdf2(s: BillSnapshot, logo_png: bytes | None, max_pages: int = MAX_PAGES) -> bytes:
    """Fallback layout: the same sections and numbers as the main layout, drawn by hand (no watermark rotation
    tricks, a simple bar chart, tables that break across pages with a repeated header). Used only when WeasyPrint
    or Pango cannot be loaded on the target."""
    import io

    from fpdf import FPDF

    he_regular, la_regular = str(FONT_DIR / "Heebo-he-400.ttf"), str(FONT_DIR / "Heebo-la-400.ttf")
    mark = STATE_MARKS.get(s.mark or "")

    class Doc(FPDF):
        def footer(self) -> None:  # noqa: D401
            self.set_y(-14)
            self.text_mode = "FILL"
            self.set_font("HeeboLa", size=8)
            self.set_text_shaping(False)
            self.cell(0, 6, f"{self.page_no()} / {{nb}}", align="C")
            self.set_x(self.l_margin)
            self.set_text_shaping(use_shaping_engine=True, direction="rtl", script="hebr", language="heb")
            self.set_font("HeeboHe", size=8)
            self.cell(0, 6, "הופק ב-SmplWise Arx", align="R")

        def header(self) -> None:  # noqa: D401
            if mark:
                with self.local_context(fill_opacity=0.10):
                    self.set_font("HeeboHe", "", 110)
                    self.set_text_color(39, 103, 237 if s.mark != "void" else 200)
                    self.set_text_shaping(use_shaping_engine=True, direction="rtl", script="hebr", language="heb")
                    with self.rotation(24, x=105, y=150):
                        self.text(40, 150, mark)
                self.set_text_color(29, 36, 51)

    pdf = Doc(format="A4")
    pdf.set_creator("SmplWise Arx")
    pdf.set_title(f"{s.title} {s.number or 'טיוטה'}")
    pdf.add_font("HeeboHe", fname=he_regular)
    pdf.add_font("HeeboLa", fname=la_regular)
    pdf.set_fallback_fonts(["HeeboLa"])
    pdf.alias_nb_pages("{nb}")
    pdf.set_margins(14, 14, 14)
    pdf.set_auto_page_break(True, margin=20)
    pdf.add_page()
    pdf.set_text_color(29, 36, 51)
    rtl = dict(use_shaping_engine=True, direction="rtl", script="hebr", language="heb")
    page_w = 210 - 28
    right = 210 - 14

    def setf(size: float, bold: bool = False) -> None:
        """Regular Heebo; bold is faked with a thin outline (fpdf2's shaping cache mixes two files of one family)."""
        pdf.set_font("HeeboHe", "", size)
        pdf.text_mode = "FILL_STROKE" if bold else "FILL"
        pdf.set_line_width(size * 0.012 if bold else 0.2)
        pdf.set_draw_color(29, 36, 51)

    def write(text: str, size: float = 10, bold: bool = False, align: str = "R", w: float = 0, h: float = 5.2) -> None:
        setf(size, bold)
        pdf.set_text_shaping(**rtl)
        pdf.set_x(pdf.l_margin)
        pdf.multi_cell(w or page_w, h, text, align=align, new_x="LMARGIN", new_y="NEXT")

    def line() -> None:
        y = pdf.get_y() + 1
        pdf.line(14, y, right, y)
        pdf.ln(3)

    def table(headers: list[str], rows: list[list[str]], widths: list[float], numeric_from: int = 1) -> None:
        def draw(cells: list[str], bold: bool, shade: bool) -> None:
            lines = 1
            for i, text in enumerate(cells):
                setf(8.5, bold)
                pdf.set_text_shaping(**rtl) if i < numeric_from or bold else pdf.set_text_shaping(False)
                lines = max(lines, len(pdf.multi_cell(widths[i], 4.6, text, dry_run=True, output="LINES")))
            h = lines * 4.6 + 1.6
            if pdf.get_y() + h > pdf.page_break_trigger:
                pdf.add_page()
                if not bold:
                    draw(headers, True, True)
            y = pdf.get_y()
            x = right
            for i, text in enumerate(cells):
                x -= widths[i]
                pdf.set_xy(x, y + 0.8)
                numeric = i >= numeric_from and not bold and not any("\u0590" <= ch <= "\u05ff" for ch in text)
                setf(8.5, bold)
                pdf.set_text_shaping(False) if numeric else pdf.set_text_shaping(**rtl)
                pdf.multi_cell(widths[i], 4.6, text, align="L" if numeric else "R", new_x="RIGHT", new_y="TOP")
            pdf.set_xy(14, y + h)
            pdf.text_mode = "FILL"
            pdf.set_line_width(0.2)
            pdf.set_draw_color(223, 227, 234)
            pdf.line(14, y + h, right, y + h)

        draw(headers, True, True)
        for r in rows:
            draw(r, False, False)
        pdf.ln(2)

    biz, cust = s.business, s.customer
    write(s.title, 16, True)
    write(s.subtitle, 9)
    write(f"מספר: {s.number or 'טיוטה'}" + (f"  (מחליף את {s.replaces_number})" if s.replaces_number else ""))
    if s.issue_date:
        write(f"תאריך הפקה: {dmy(s.issue_date)}")
    write(biz.name, 11, True)
    for t in (f"ח.פ. {biz.reg_no}" if biz.reg_no else "", biz.address, " · ".join(x for x in (biz.phone, biz.email) if x)):
        if t:
            write(t, 9)
    line()
    write("לכבוד: " + cust.name, 10, True)
    for t in (cust.address, f"מספר לקוח: {cust.number}" if cust.number else "",
              f"חשבון: {cust.account_name}" if cust.account_name else ""):
        if t:
            write(t)
    write(f"תקופת החיוב: {dmy(s.period_start)} - {dmy(s.period_end)} ({s.days} ימים)", 10, True)
    if s.tariff_name:
        write(f"תעריף: {s.tariff_name}")
    if s.due_date:
        write(f"לתשלום עד: {dmy(s.due_date)}")
    write(f"סה״כ לתשלום: {money(s.total)} ₪", 15, True)
    pdf.ln(2)
    flagged = [m for m in s.meters if m.last_report is not None]
    table(["מונה", "קריאה בתחילת התקופה", "קריאה בסוף התקופה", "צריכה (קוט״ש)", "חלק", "לחיוב (קוט״ש)"],
          [[m.name + (" *" if m.last_report is not None else ""), reading(m.start_reading), reading(m.end_reading),
            kwh(m.consumption_kwh), m.share_text.replace("\u2212", "-"),
            kwh(m.billed_kwh)] for m in s.meters], [48, 30, 30, 28, 16, 30])
    if s.formula_text:
        write("נוסחת החשבון: " + s.formula_text, 9)
    rows = [["צריכת חשמל" + (f" {dmy(c.period_start)} - {dmy(c.period_end)}" if len(s.charges) > 1 and c.period_start
                              and c.period_end else ""), f"{kwh(c.kwh)} קוט״ש", f"{price(c.price_per_kwh)} ₪",
             money(c.amount)] for c in s.charges]
    rows.append(["סה״כ לפני מע״מ", "", "", money(s.subtotal)])
    rates: dict[Any, Any] = {}
    for c in s.charges:
        rates[c.vat_rate_pct] = rates.get(c.vat_rate_pct, 0) + c.vat_amount
    for rate, amount in rates.items():
        rows.append([f"מע״מ {rate.normalize():f}%", "", "", money(amount)])
    rows.append(["סה״כ לתשלום", "", "", money(s.total) + " ₪"])
    table(["פירוט", "כמות", "מחיר ליחידה", "סכום (₪)"], rows, [80, 38, 32, 32])

    prev, ly = chart_series(s)
    if prev or ly:
        if pdf.get_y() > 200:
            pdf.add_page()
        write("צריכה בתקופות קודמות (קוט״ש)", 10, True)
        pts = [(p.period_end, p.kwh, "p") for p in prev] + [(s.period_end, s.total_kwh, "c")]
        if ly is not None:
            pts.append((ly.period_end, ly.kwh, "y"))
        vmax = max(v for _, v, _ in pts) or 1
        slot = page_w / len(pts)
        base = pdf.get_y() + 38
        pdf.set_draw_color(17, 17, 17)
        for i, (d, v, kind) in enumerate(pts):
            h = float(v / vmax) * 30
            x = 14 + slot * i + slot * 0.18
            w = slot * 0.64
            pdf.set_fill_color(*((39, 103, 237) if kind == "c" else (255, 255, 255) if kind == "y" else (217, 222, 232)))
            pdf.rect(x, base - h, w, h, style="DF")
            pdf.set_font("HeeboLa", size=7)
            pdf.set_text_shaping(False)
            pdf.set_xy(x - slot * 0.18, base - h - 4)
            pdf.cell(slot, 4, f"{v:,.0f}", align="C")
            pdf.set_xy(x - slot * 0.18, base + 0.5)
            pdf.cell(slot, 4, f"{d.month:02d}.{d.year % 100:02d}", align="C")
        pdf.set_xy(14, base + 6)
        pdf.ln(1)
        if ly is not None:
            write("העמודה הלבנה: אותה תקופה אשתקד", 8)
    notes = []
    if s.price_note:
        notes.append(s.price_note)
    notes.append("הקריאות הן קריאות מונה מצטברות שנמדדו בפועל.")
    if s.previous_kwh is not None:
        notes.append(f"צריכה בתקופה הקודמת: {kwh(s.previous_kwh)} קוט״ש.")
    write(" ".join(notes), 9)
    for m in flagged:
        if m.report_note:
            extra = "" if dmy(m.last_report.date()) in m.report_note else f" תאריך הדיווח האחרון: {moment(m.last_report)}."
            write(f"* {m.report_note}{extra}", 9)
        else:
            write(f"* המונה {m.name} לא דיווח בעת הפקת החשבון. תאריך הדיווח האחרון: {moment(m.last_report)}. "
                  "החיוב כולל רק מה שנמדד.", 9)
    if s.replaces_number:
        write(f"חשבון מתוקן: חשבון זה מחליף את חשבון מספר {s.replaces_number}.", 9)
    if s.mark == "void":
        write("חשבון זה בוטל ואינו בתוקף.", 9, True)
    for text in s.notes:
        write(text, 9)
    if s.footer_note:
        write("הערות: " + s.footer_note, 9)
    if pdf.page > max_pages:
        raise RenderRefused("pdf_page_limit")
    out = pdf.output()
    data = bytes(out) if not isinstance(out, bytes) else out
    if len(data) > MAX_PDF_BYTES:
        raise RenderRefused("pdf_too_large")
    return data


# ---------------------------------------------------------------------------------------------------- worker entry
def apply_limits(memory_bytes: int, cpu_seconds: int, fsize_bytes: int) -> None:
    """Resource limits of the render process, set by the process itself at start-up (a preexec_fn in the parent would
    not be thread-safe inside the web server). POSIX only; on other systems the parent's timeout still applies."""
    try:
        import resource
    except ImportError:  # pragma: no cover
        return
    for which, value in ((resource.RLIMIT_AS, memory_bytes), (resource.RLIMIT_CPU, cpu_seconds),
                         (resource.RLIMIT_FSIZE, fsize_bytes)):
        _soft, hard = resource.getrlimit(which)
        resource.setrlimit(which, (value if hard == resource.RLIM_INFINITY else min(value, hard), hard))


def deny_network() -> None:
    """Defence in depth for the render process: any attempt to resolve a name or open a socket raises. The URL fetcher
    already refuses every URL; this makes a library-level surprise fail loudly instead of reaching a network."""
    import socket

    def refuse(*_a: Any, **_k: Any):
        raise PermissionError("network access is disabled in the bill renderer")

    socket.socket.connect = refuse  # type: ignore[method-assign]
    socket.socket.connect_ex = refuse  # type: ignore[method-assign]
    socket.getaddrinfo = refuse  # type: ignore[assignment]
    socket.gethostbyname = refuse  # type: ignore[assignment]
    socket.create_connection = refuse  # type: ignore[assignment]


def run_job(job: dict[str, Any]) -> tuple[bytes, str]:
    logo = base64.b64decode(job["logo"]) if job.get("logo") else None
    s = BillSnapshot.from_billing_snapshot(job["snapshot"], logo=logo, watermark=job.get("watermark"))
    max_pages = int(job.get("max_pages") or MAX_PAGES)
    engine = job.get("engine") or "auto"
    if engine in ("auto", "weasyprint"):
        try:
            return render_weasyprint(s, logo, max_pages), "weasyprint"
        except RenderRefused:
            raise
        except Exception as exc:
            if engine == "weasyprint":
                raise
            print(f"weasyprint failed ({type(exc).__name__}); using fpdf2", file=sys.stderr)
    return render_fpdf2(s, logo, max_pages), "fpdf2"


def self_check(engine: str) -> int:
    """Start-up self-check job: which engine can render here. Prints `engine=<name>` (and `reason=` for a fallback)."""
    reason = ""
    if engine in ("auto", "weasyprint"):
        try:
            import logging

            from weasyprint import HTML

            logging.getLogger("weasyprint").setLevel(logging.ERROR)
            HTML(string="<p>\u05d1\u05d3\u05d9\u05e7\u05d4 123</p>", base_url=None, url_fetcher=LockedFetcher(None)).render().write_pdf()
            sys.stdout.write("engine=weasyprint\n")
            return 0
        except Exception as exc:  # noqa: BLE001 - any failure of the stack means the fallback is in force
            reason = f"weasyprint unavailable: {type(exc).__name__}: {str(exc)[:100]}"
            if engine == "weasyprint":
                sys.stdout.write(f"reason={reason}\n")
                return 4
    try:
        from fpdf import FPDF

        pdf = FPDF(format="A4")
        pdf.add_font("HeeboHe", fname=str(FONT_DIR / "Heebo-he-400.ttf"))
        pdf.add_page()
        pdf.set_font("HeeboHe", size=10)
        pdf.cell(0, 6, "123")
        pdf.output()
        sys.stdout.write("engine=fpdf2\n" + (f"reason={reason}\n" if reason else ""))
        return 0
    except Exception as exc:  # noqa: BLE001
        sys.stdout.write(f"reason={reason + '; ' if reason else ''}fpdf2 unavailable: {type(exc).__name__}\n")
        return 4


def main() -> int:
    deny_network()
    job = json.loads(sys.stdin.buffer.read())
    if job.get("selfcheck"):
        return self_check(str(job.get("engine") or "auto"))
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
