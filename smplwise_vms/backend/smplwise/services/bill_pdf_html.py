"""HTML + CSS for the electricity bill PDF (CR-023 P3), built from a `BillSnapshot`.

Safety contract: every value that came from a person (names, addresses, notes, meter names, tariff text) goes through
`E()` (html.escape) exactly once and lands in element text, never in an attribute that is interpreted (no href, src,
style or event attribute is ever built from data). The only URLs in the document are the fixed asset names below,
which the renderer's fetcher resolves from the bundled folder or from the re-encoded logo, and nothing else.
The layout follows the approved A4 mockup (docs/design/mockups/electricity, "bill" screens).
"""
from __future__ import annotations

import html
import re
from datetime import date, datetime
from decimal import ROUND_HALF_UP, Decimal

from .bill_pdf_model import BillSnapshot, HistoryPoint

E = html.escape

ASSET_SCHEME = "bill-asset:"
LOGO_URL = "bill-logo:logo.png"
FONT_FILES = ("Heebo-he-400.ttf", "Heebo-he-700.ttf", "Heebo-la-400.ttf", "Heebo-la-700.ttf")

CHART_MAX_PREVIOUS = 12

STATE_MARKS = {"draft": "טיוטה", "void": "בוטל", "copy": "העתק"}
_Q2 = Decimal("0.01")
_Q4 = Decimal("0.0001")


# ---------------------------------------------------------------------------------------------------- formatting
def money(x: Decimal) -> str:
    return f"{x.quantize(_Q2, rounding=ROUND_HALF_UP):,.2f}"


def kwh(x: Decimal) -> str:
    return f"{x.quantize(_Q2, rounding=ROUND_HALF_UP):,.2f}"


def reading(x: Decimal) -> str:
    """A meter reading: 3 places as stored, but a trailing zero beyond the second place is not printed."""
    text = f"{x.quantize(Decimal('0.001'), rounding=ROUND_HALF_UP):,.3f}"
    return text[:-1] if text.endswith("0") else text


def price(x: Decimal) -> str:
    return f"{x.quantize(_Q4, rounding=ROUND_HALF_UP):,.4f}"


def dmy(d: date) -> str:
    return f"{d.day:02d}.{d.month:02d}.{d.year}"


def moment(v: datetime | date) -> str:
    if isinstance(v, datetime):
        return f"{dmy(v.date())} {v.hour:02d}:{v.minute:02d}"
    return dmy(v)


def ym_label(d: date) -> str:
    return f"{d.month:02d}.{d.year % 100:02d}"


def pct(x: Decimal) -> str:
    text = format(x.normalize(), "f")
    return text.rstrip("0").rstrip(".") if "." in text else text


def num(text: str) -> str:
    """A number, date or code: always laid out left-to-right inside the right-to-left text."""
    return f'<span class="n">{E(text)}</span>'


def rng(a: date, b: date) -> str:
    """A date range read right-to-left from the first date to the last, like the approved mockup."""
    return f"{num(dmy(a))} - {num(dmy(b))}"


_NUM_RE = re.compile(r"\d{2}\.\d{2}\.\d{4}(?: \d{2}:\d{2})?|\d{4}-\d{2}-\d{4,10}(?:/\d+)?(?:-\d+)?|\d[\d,]*\.\d+|\d{1,2}:\d{2}")


def rich(text: str) -> str:
    """Escape a server-written sentence and lay its dates, times, bill numbers and decimals out left-to-right, so a
    date written 29.09.2026 07:10 inside Hebrew reads in that order. Escaping happens first; the pattern only matches
    digits and separators, so nothing it wraps can contain markup."""
    return _NUM_RE.sub(lambda m: f'<span class="n">{m.group(0)}</span>', E(text))


def with_shekel(x: Decimal) -> str:
    return num(f"{money(x)} ₪")


# ---------------------------------------------------------------------------------------------------- the chart
def chart_series(s: BillSnapshot) -> tuple[list[HistoryPoint], HistoryPoint | None]:
    """The previous periods to draw (at most 12, oldest first) and the same period last year. Never invents data:
    points that overlap or follow the current period, duplicates and negative values are dropped."""
    seen: set[tuple[date, date]] = set()
    prev: list[HistoryPoint] = []
    for p in sorted(s.history, key=lambda h: (h.period_end, h.period_start)):
        key = (p.period_start, p.period_end)
        if key in seen or p.kwh < 0 or p.period_end < p.period_start or p.period_end >= s.period_start:
            continue
        seen.add(key)
        prev.append(p)
    prev = prev[-CHART_MAX_PREVIOUS:]
    ly = s.same_period_last_year
    if ly is not None and (ly.kwh < 0 or ly.period_end < ly.period_start or ly.period_end >= s.period_start):
        ly = None
    return prev, ly


def _hatch(pid: str, stroke: str = "#1d2433") -> str:
    return (f'<pattern id="{pid}" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">'
            f'<rect width="5" height="5" fill="#ffffff"/><line x1="0" y1="0" x2="0" y2="5" stroke="{stroke}" '
            f'stroke-width="2"/></pattern>')


def chart_svg(s: BillSnapshot, prev: list[HistoryPoint], ly: HistoryPoint | None) -> str:
    """Inline SVG bar chart: previous periods (light, outlined), the current period (accent, heavy outline), the same
    period last year (hatched, plus a dashed reference line). Readable in black and white: the three kinds differ by
    fill pattern and outline, not by colour. Only digits and Latin appear inside the SVG (labels are MM.YY, values
    are numbers); all Hebrew text is HTML around it."""
    width, height = 680, 104
    top, bottom, side = 22, 22, 8
    entries: list[tuple[str, Decimal, str, bool]] = [(ym_label(p.period_end), p.kwh, "prev", p.partial) for p in prev]
    entries.append((ym_label(s.period_end), s.total_kwh, "cur", False))
    if ly is not None:
        entries.append((ym_label(ly.period_end), ly.kwh, "ly", ly.partial))
    n = len(entries)
    vmax = max((e[1] for e in entries), default=Decimal(0))
    plot_h = height - top - bottom
    slot = (width - 2 * side) / n
    bw = min(slot * 0.62, 38.0)
    base_y = height - bottom
    accent = E(s.business.accent)
    parts = [f'<svg class="chart" xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
             f'viewBox="0 0 {width} {height}" role="img" aria-label="consumption chart">',
             "<title>consumption chart</title>", f"<defs>{_hatch('hatch')}</defs>",
             f'<line x1="{side}" x2="{width - side}" y1="{base_y}" y2="{base_y}" stroke="#8a94a8" stroke-width="1"/>']

    def y_of(v: Decimal) -> float:
        return base_y - (float(v / vmax) * plot_h if vmax > 0 else 0.0)

    if ly is not None and vmax > 0:
        yl = y_of(ly.kwh)
        parts.append(f'<line x1="{side}" x2="{width - side}" y1="{yl:.1f}" y2="{yl:.1f}" stroke="#5b6475" '
                     f'stroke-width="1" stroke-dasharray="5 3"/>')
    for i, (label, value, kind, partial) in enumerate(entries):
        cx = side + slot * (i + 0.5)
        x = cx - bw / 2
        y = y_of(value)
        h = max(base_y - y, 0.0)
        if kind == "cur":
            style = f'fill="{accent}" stroke="#111111" stroke-width="2"'
        elif kind == "ly":
            style = 'fill="url(#hatch)" stroke="#111111" stroke-width="1.2"'
        else:
            style = 'fill="#d9dee8" stroke="#5b6475" stroke-width="1"'
        if partial:  # a lower bound (some data was missing): dashed outline and a plus sign on the value
            style += ' stroke-dasharray="3 2"'
        parts.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{bw:.1f}" height="{h:.1f}" {style}/>')
        weight = "700" if kind == "cur" else "400"
        value_txt = f"{value:,.0f}" + ("+" if partial else "")
        ty = max(y - 4, 10)
        if ly is not None:  # EL8 visual review: a white plate keeps the dashed reference line from striking through the digits
            pw = 5.6 * len(value_txt) + 4
            parts.append(f'<rect class="vbg" x="{cx - pw / 2:.1f}" y="{ty - 8.5:.1f}" width="{pw:.1f}" height="10.5" fill="#ffffff"/>')
        parts.append(f'<text x="{cx:.1f}" y="{ty:.1f}" text-anchor="middle" font-family="HeeboLa" '
                     f'font-size="9.5" font-weight="{weight}" fill="#1d2433">{E(value_txt)}</text>')
        parts.append(f'<text x="{cx:.1f}" y="{height - 7}" text-anchor="middle" font-family="HeeboLa" '
                     f'font-size="9.5" font-weight="{weight}" fill="#1d2433">{E(label)}</text>')
    parts.append("</svg>")
    return "".join(parts)


def chart_section(s: BillSnapshot) -> str:
    prev, ly = chart_series(s)
    if not prev and ly is None:
        return ""  # nothing to compare with: no chart at all, no empty frame
    rows: list[tuple[str, Decimal, str, bool]] = [(rng(p.period_start, p.period_end), p.kwh, "", p.partial) for p in prev]
    rows.append((rng(s.period_start, s.period_end), s.total_kwh, "cur", False))
    if ly is not None:
        rows.append((rng(ly.period_start, ly.period_end), ly.kwh, "ly", ly.partial))
    any_partial = any(r[3] for r in rows)
    half = (len(rows) + 2) // 3
    trs = []
    for i in range(half):
        cells = []
        for j in (i, i + half, i + 2 * half):
            if j < len(rows):
                label, value, kind, partial = rows[j]
                tag = " (נוכחית)" if kind == "cur" else " (אשתקד)" if kind == "ly" else ""
                cls = ' class="cur"' if kind == "cur" else ""
                ncls = "n cur" if kind == "cur" else "n"
                cells.append(f"<td{cls}>{label}{E(tag)}</td><td class='{ncls}'>{E(kwh(value))}{"+" if partial else ""}</td>")
            else:
                cells.append("<td></td><td></td>")
        trs.append("<tr>" + "".join(cells) + "</tr>")
    legend = (
        '<div class="legend">'
        '<span><i class="sw cur"></i>התקופה הנוכחית</span>'
        '<span><i class="sw prev"></i>תקופות קודמות</span>' +
        ('<span><i class="sw ly"></i>אותה תקופה אשתקד</span>' if ly is not None else "") +
        ('<span>+ נתונים חלקיים (חסרים נתונים בחלק מהתקופה)</span>' if any_partial else "") + "</div>")
    return (f'<section class="chartbox"><h2>צריכה בתקופות קודמות (קוט״ש)</h2>{legend}{chart_svg(s, prev, ly)}'
            f'<table class="mini"><colgroup>{"<col class='c1'><col class='c2'>" * 3}</colgroup><tbody>{"".join(trs)}</tbody></table></section>')


# ---------------------------------------------------------------------------------------------------- the page
def _css(accent: str) -> str:
    return f"""
@font-face {{ font-family: HeeboHe; src: url("{ASSET_SCHEME}Heebo-he-400.ttf"); font-weight: 400; }}
@font-face {{ font-family: HeeboHe; src: url("{ASSET_SCHEME}Heebo-he-700.ttf"); font-weight: 700; }}
@font-face {{ font-family: HeeboLa; src: url("{ASSET_SCHEME}Heebo-la-400.ttf"); font-weight: 400; }}
@font-face {{ font-family: HeeboLa; src: url("{ASSET_SCHEME}Heebo-la-700.ttf"); font-weight: 700; }}
@page {{ size: A4; margin: 10mm 14mm 16mm;
  @bottom-center {{ content: "עמוד " counter(page) " מתוך " counter(pages); font: 8pt HeeboHe, HeeboLa; color: #5b6a85; }}
  @bottom-left {{ content: element(runhash); font: 8pt HeeboHe, HeeboLa; color: #8a94a8; }}
  @bottom-right {{ content: "הופק ב-SmplWise Arx"; font: 8pt HeeboHe, HeeboLa; color: #8a94a8; }} }}
html {{ direction: rtl; }}
body {{ font-family: HeeboHe, HeeboLa, sans-serif; font-size: 9.5pt; color: #1d2433; margin: 0; line-height: 1.3; }}
.n {{ direction: ltr; unicode-bidi: isolate; text-align: left; white-space: nowrap; }}
.r {{ text-align: left; }}
.ph {{ display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2.5px solid {accent};
  padding-bottom: 3mm; }}
.ph .biz {{ display: flex; gap: 4mm; align-items: flex-start; }}
.ph .bizt {{ max-width: 70mm; overflow-wrap: anywhere; }}
.ph .logo {{ flex: none; width: auto; height: auto; max-width: 34mm; max-height: 17mm; }}
.ph .bizt {{ flex: 1; }}
h1 {{ font-size: 16pt; margin: 0; overflow-wrap: anywhere; }}
h2 {{ font-size: 10.5pt; margin: 0 0 2mm; }}
.sub {{ color: #5b6a85; font-size: 9pt; }}
.meta {{ margin-top: 3mm; }}
.two {{ display: flex; gap: 4mm; margin-top: 4mm; }}
.two > .bx {{ flex: 1; min-width: 0; }}
.bx {{ border: 1px solid #c9d0dd; border-radius: 2.5mm; padding: 3mm 4mm; overflow-wrap: anywhere; }}
.big {{ display: flex; justify-content: space-between; align-items: center; margin-top: 4mm; background: #f1f4f9;
  border: 1px solid #c9d0dd; border-radius: 2.5mm; padding: 2.5mm 5mm; break-inside: avoid; }}
.big b {{ font-size: 18pt; }}
table {{ width: 100%; border-collapse: collapse; margin-top: 4mm; }}
th {{ background: #eef1f6; text-align: right; padding: 1.1mm 2.2mm; font-size: 8.5pt; border-bottom: 1px solid #98a2b6; }}
td {{ border-bottom: 1px solid #dfe3ea; padding: 1.1mm 2.2mm; overflow-wrap: anywhere; vertical-align: top; }}
tr {{ break-inside: avoid; }}
thead {{ display: table-header-group; }}
td.n, th.n {{ text-align: left; }}
.tot td {{ font-weight: 700; font-size: 12pt; border-top: 2px solid #1d2433; border-bottom: 0; }}
.note {{ margin-top: 2.5mm; color: #3d4a63; font-size: 9pt; overflow-wrap: anywhere; }}
.notes-user {{ white-space: pre-line; }}
.warn {{ border: 1px solid #1d2433; border-radius: 2mm; padding: 1.5mm 3mm; margin-top: 2.5mm; font-size: 9pt; }}
.chartbox {{ margin-top: 4mm; break-inside: avoid; border: 1px solid #c9d0dd; border-radius: 2.5mm; padding: 3mm 4mm; }}
.chart {{ display: block; width: 100%; height: auto; }}
.legend {{ font-size: 8.5pt; margin-bottom: 1mm; display: flex; gap: 6mm; flex-wrap: wrap; }}
.legend .sw {{ display: inline-block; width: 4mm; height: 3mm; margin-inline-end: 1.5mm; border: 1px solid #111; }}
.sw.cur {{ background: {accent}; border-width: 1.6px; }}
.sw.prev {{ background: #d9dee8; border-color: #5b6475; }}
.sw.ly {{ background: repeating-linear-gradient(45deg, #fff 0, #fff 1mm, #1d2433 1mm, #1d2433 1.5mm); }}
table.mini {{ margin-top: 2mm; font-size: 7.5pt; table-layout: fixed; }}
col.c1 {{ width: 25%; }} col.c2 {{ width: 8.3%; }}
table.mini td {{ padding: 0.8mm 1.5mm; }}
table.mini td.cur {{ font-weight: 700; }}
.runhash {{ position: running(runhash); font-size: 8pt; color: #8a94a8; line-height: 1; }}
.wm {{ position: fixed; top: 95mm; left: 0; right: 0; text-align: center; font-size: 120pt; font-weight: 700;
  color: rgba(39, 103, 237, 0.10); transform: rotate(-24deg); }}
.wm.void {{ color: rgba(200, 40, 40, 0.14); }}
"""


LOGO_MAX_W_MM, LOGO_MAX_H_MM = 34.0, 17.0


def logo_box_mm(size: tuple[int, int] | None) -> tuple[float, float] | None:
    """The logo's printed size: its pixel aspect ratio fitted into the 34 x 17 mm header box (scaled up or down).
    EL8: a fixed 17 mm height with `width: auto` let a wide logo (e.g. 400 x 120 px) grow past the page edge."""
    if not size or size[0] <= 0 or size[1] <= 0:
        return None
    w, h = int(size[0]), int(size[1])
    scale = min(LOGO_MAX_W_MM / w, LOGO_MAX_H_MM / h)
    return round(w * scale, 2), round(h * scale, 2)


def build_html(s: BillSnapshot, has_logo: bool, logo_size: tuple[int, int] | None = None) -> str:
    mark = STATE_MARKS.get(s.mark or "")
    biz, cust = s.business, s.customer
    number_txt = s.number or "טיוטה"
    title = f"{s.title} {number_txt}"

    # --- header
    biz_lines = []
    if biz.reg_no:
        biz_lines.append(f"ח.פ. {num(biz.reg_no)}")
    if biz.address:
        biz_lines.append(E(biz.address))
    contact = " · ".join(x for x in (num(biz.phone) if biz.phone else "", num(biz.email) if biz.email else "") if x)
    if contact:
        biz_lines.append(contact)
    logo = ""
    if has_logo:
        box = logo_box_mm(logo_size)
        size = f' style="width: {box[0]:.2f}mm; height: {box[1]:.2f}mm"' if box else ""  # numbers computed here, not data text
        logo = f'<img class="logo" src="{LOGO_URL}" alt=""{size}>'
    meta = f"<b>מספר:</b> {num(number_txt) if s.number else E(number_txt)}"
    if s.replaces_number:
        meta += f' <span class="sub">(מחליף את {num(s.replaces_number)})</span>'
    if s.issue_date:
        meta += f"<br><b>תאריך הפקה:</b> {num(dmy(s.issue_date))}"
    header = (f'<div class="ph"><div><h1>{E(s.title)}</h1><div class="sub">{E(s.subtitle)}</div>'
              f'<div class="meta">{meta}</div></div>'
              f'<div class="biz"><div class="bizt"><b>{E(biz.name)}</b><br><span class="sub">{"<br>".join(biz_lines)}</span></div>'
              f"{logo}</div></div>")

    # --- customer and period
    cust_lines = [f"<b>לכבוד</b>", E(cust.name)]
    if cust.address:
        cust_lines.append(E(cust.address))
    if cust.number:
        cust_lines.append(f"מספר לקוח: {num(cust.number)}")
    if cust.account_name:
        cust_lines.append(f"חשבון: {E(cust.account_name)}")
    per_lines = ["<b>תקופת החיוב</b>",
                 f"{num(dmy(s.period_start))} - {num(dmy(s.period_end))} ({s.days} ימים)"]
    if s.tariff_name:
        per_lines.append(f"תעריף: {E(s.tariff_name)}")
    if s.due_date:
        per_lines.append(f"לתשלום עד: {num(dmy(s.due_date))}")
    two = f'<div class="two"><div class="bx">{"<br>".join(cust_lines)}</div><div class="bx">{"<br>".join(per_lines)}</div></div>'
    big = f'<div class="big"><span>סה״כ לתשלום</span><b>{with_shekel(s.total)}</b></div>'

    # --- meters
    flagged = []
    rows = []
    for m in s.meters:
        star = ""
        if m.last_report is not None:
            flagged.append(m)
            star = " *"
        share = m.share_text
        rows.append(f"<tr><td>{E(m.name)}{star}</td><td class='n'>{E(reading(m.start_reading))}</td>"
                    f"<td class='n'>{E(reading(m.end_reading))}</td><td class='n'>{E(kwh(m.consumption_kwh))}</td>"
                    f"<td class='n'>{E(share)}</td><td class='n'>{E(kwh(m.billed_kwh))}</td></tr>")
    meters = ("<table><thead><tr><th>מונה</th><th>קריאה בתחילת התקופה</th><th>קריאה בסוף התקופה</th>"
              "<th>צריכה (קוט״ש)</th><th>חלק</th><th>לחיוב (קוט״ש)</th></tr></thead><tbody>"
              + "".join(rows) + "</tbody></table>")
    formula = f'<div class="note">נוסחת החשבון: {E(s.formula_text)}</div>' if s.formula_text else ""

    # --- charges
    crow = []
    many = len(s.charges) > 1
    for c in s.charges:
        label = "צריכת חשמל"
        if many and c.period_start and c.period_end:
            label += f" {rng(c.period_start, c.period_end)}"
        crow.append(f"<tr><td>{label}</td><td class='n'>{E(kwh(c.kwh))} קוט״ש</td>"
                    f"<td class='n'>{E(price(c.price_per_kwh))} ₪</td><td class='n'>{E(money(c.amount))}</td></tr>")
    crow.append(f"<tr><td>סה״כ לפני מע״מ</td><td></td><td></td><td class='n'>{E(money(s.subtotal))}</td></tr>")
    by_rate: dict[Decimal, Decimal] = {}
    for c in s.charges:
        by_rate[c.vat_rate_pct] = by_rate.get(c.vat_rate_pct, Decimal(0)) + c.vat_amount
    for rate, amount in by_rate.items():
        crow.append(f"<tr><td>מע״מ {E(pct(rate))}%</td><td></td><td></td><td class='n'>{E(money(amount))}</td></tr>")
    diff = s.vat_total - sum(by_rate.values(), Decimal(0))
    if diff.quantize(_Q2) != 0:
        crow.append(f"<tr><td>הפרשי עיגול</td><td></td><td></td><td class='n'>{E(money(diff))}</td></tr>")
    crow.append(f"<tr class='tot'><td>סה״כ לתשלום</td><td></td><td></td><td class='n'>{with_shekel(s.total)}</td></tr>")
    charges = ("<table><thead><tr><th>פירוט</th><th>כמות</th><th>מחיר ליחידה</th><th>סכום (₪)</th></tr></thead>"
               f"<tbody>{''.join(crow)}</tbody></table>")

    # --- notes
    notes_html = []
    base = []
    if s.price_note:
        base.append(E(s.price_note))
    base.append("הקריאות הן קריאות מונה מצטברות שנמדדו בפועל.")
    line = " ".join(base)
    if s.previous_kwh is not None:
        line += f" צריכה בתקופה הקודמת: {num(kwh(s.previous_kwh))} קוט״ש."
    notes_html.append(f'<div class="note">{line}</div>')
    for m in flagged:
        text = (f"* המונה {E(m.name)} לא דיווח בעת הפקת החשבון. תאריך הדיווח האחרון: {num(moment(m.last_report))}. "
                "החיוב כולל רק מה שנמדד.")
        if m.report_note:  # the server's own sentence says where the rest of the energy goes
            text = f"* {rich(m.report_note)}"
            if dmy(m.last_report.date()) not in m.report_note:  # the last report date must always be on the bill
                text += f" תאריך הדיווח האחרון: {num(moment(m.last_report))}."
        notes_html.append(f'<div class="warn">{text}</div>')
    if s.replaces_number:
        notes_html.append(f'<div class="warn">חשבון מתוקן: חשבון זה מחליף את חשבון מספר {num(s.replaces_number)}.</div>')
    if s.mark == "void":
        notes_html.append('<div class="warn">חשבון זה בוטל ואינו בתוקף.</div>')
    if s.mark == "copy":
        notes_html.append('<div class="note">העתק של החשבון המקורי.</div>')
    for text in s.notes:
        notes_html.append(f'<div class="note">{rich(text)}</div>')
    if s.footer_note:
        notes_html.append(f'<div class="note notes-user"><b>הערות:</b> {rich(s.footer_note)}</div>')
    if s.snapshot_hash:  # printed in the page footer of every page through a running element
        notes_html.append(f'<div class="runhash">מזהה חשבון: {num(s.snapshot_hash)}</div>')

    wm = f'<div class="wm {"void" if s.mark == "void" else ""}">{E(mark)}</div>' if mark else ""
    body = "".join([wm, header, two, big, meters, formula, charges, chart_section(s), *notes_html])
    return (f'<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>{E(title)}</title>'
            f'<meta name="author" content="SmplWise Arx"><style>{_css(E(biz.accent))}</style></head>'
            f"<body>{body}</body></html>")
