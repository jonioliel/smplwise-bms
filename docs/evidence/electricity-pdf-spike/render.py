"""Electricity bill PDF spike (CR-023 P0). Fake data only. Not product code.

Renders a Hebrew RTL consumption bill with WeasyPrint and a locked URL fetcher, times it, and writes
sample-1p.pdf (the bill) and sample-3p.pdf (the bill plus a daily appendix for three meters).
Run inside a venv that has weasyprint installed, with ./fonts holding the Heebo TTF files (see spike.sh).
"""
import html
import json
import os
import resource
import sys
import time

T0 = time.perf_counter()
import weasyprint  # noqa: E402
from weasyprint import HTML  # noqa: E402
from weasyprint.urls import URLFetcher  # noqa: E402  (WeasyPrint 68+ fetcher API)

IMPORT_S = time.perf_counter() - T0
HERE = os.path.dirname(os.path.abspath(__file__))
FONTDIR = os.path.join(HERE, "fonts")
BLOCKED = []


class LockedFetcher(URLFetcher):
    """Only the bundled font directory may be read; everything else (http, data, other files) is refused."""

    def __init__(self):
        super().__init__(allowed_protocols={"file"}, allow_redirects=False, timeout=2)

    def fetch(self, url, headers=None):
        prefix = "file://" + FONTDIR + "/"
        if url.startswith(prefix) and ".." not in url:
            return super().fetch(url, headers)
        BLOCKED.append(url)
        raise ValueError("blocked by the bill renderer: " + url)


def locked_fetcher():
    return LockedFetcher()


E = html.escape  # every user-entered value goes through this

BUSINESS = {"name": "נכסי הדוגמה בע״מ", "reg": "ח.פ. 510000000", "address": "רחוב הדוגמה 12, עיר לדוגמה",
            "phone": "03-0000000", "email": "billing@example.co.il"}
CUSTOMER = {"name": "סטודיו אורן לעיצוב", "number": "0001", "address": "רחוב הדוגמה 12, קומה 1, עיר לדוגמה",
            "account": "סטודיו אורן - קומה 1"}
# injection probes: must print as text, never load anything
NOTE = 'הערה לבדיקה: <script>alert(1)</script> <img src="http://example.invalid/x.png"> url(http://example.invalid/a)'
METERS = [  # name, start reading, end reading, factor
    ("לוח סטודיו", 12480.62, 13166.10, 1.0),
    ("תאורת לובי", 4210.30, 4512.70, 0.30),
]
PRICE_EX_VAT = 0.5430
VAT = 0.18


def money(x):
    return f"{x:,.2f}"


def bill_html(appendix_meters: int) -> str:
    rows = []
    total_kwh = 0.0
    for name, a, b, f in METERS:
        kwh = round(b - a, 2)
        part = round(kwh * f, 2)
        total_kwh += part
        share = "" if f == 1 else f"{int(f * 100)}%"
        rows.append(f"<tr><td>{E(name)}</td><td class=n>{a:,.2f}</td><td class=n>{b:,.2f}</td><td class=n>{kwh:,.2f}</td>"
                    f"<td class=n>{share}</td><td class=n>{part:,.2f}</td></tr>")
    total_kwh = round(total_kwh, 2)
    amount = round(total_kwh * PRICE_EX_VAT + 1e-9, 2)
    vat = round(amount * VAT + 1e-9, 2)
    total = round(amount + vat, 2)
    days = []
    if appendix_meters:
        for m in range(appendix_meters):
            days.append(f"<h3>פירוט יומי - {E(['לוח סטודיו', 'תאורת לובי', 'מזגן משותף'][m % 3])}</h3>")
            days.append("<table class=grid><thead><tr><th>תאריך</th><th>יום</th><th>קריאה בתחילת היום</th>"
                        "<th>קריאה בסוף היום</th><th>קוט״ש</th></tr></thead><tbody>")
            r = 12480.62
            for d in range(1, 31):
                use = 18.4 + (d * 7 % 11) * 0.9
                dn = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"][(d + 1) % 7]
                days.append(f"<tr><td class=n>{d:02d}.09.2026</td><td>{dn}</td><td class=n>{r:,.2f}</td>"
                            f"<td class=n>{r + use:,.2f}</td><td class=n>{use:,.2f}</td></tr>")
                r += use
            days.append("</tbody></table>")
    return f"""<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><style>
@font-face {{ font-family: HeeboHe; src: url("file://{FONTDIR}/Heebo-he-400.ttf"); font-weight: 400; }}
@font-face {{ font-family: HeeboHe; src: url("file://{FONTDIR}/Heebo-he-700.ttf"); font-weight: 700; }}
@font-face {{ font-family: HeeboLa; src: url("file://{FONTDIR}/Heebo-la-400.ttf"); font-weight: 400; }}
@font-face {{ font-family: HeeboLa; src: url("file://{FONTDIR}/Heebo-la-700.ttf"); font-weight: 700; }}
@page {{ size: A4; margin: 16mm 14mm 18mm;
  @bottom-center {{ content: "עמוד " counter(page) " מתוך " counter(pages); font: 8pt HeeboHe, HeeboLa; color: #667; }}
  @bottom-left {{ content: "SmplWise Arx"; font: 8pt HeeboLa; color: #99a; }} }}
body {{ font-family: HeeboHe, HeeboLa; font-size: 10pt; color: #1d2433; }}
.n {{ direction: ltr; unicode-bidi: isolate; text-align: left; font-variant-numeric: tabular-nums; }}
header {{ display: flex; justify-content: space-between; border-bottom: 2px solid #2767ed; padding-bottom: 6mm; }}
h1 {{ font-size: 16pt; margin: 0; }} h3 {{ margin: 8mm 0 2mm; }}
.box {{ border: 1px solid #d5dbe6; border-radius: 3mm; padding: 3mm 4mm; margin-top: 4mm; }}
.two {{ display: flex; gap: 4mm; }} .two > div {{ flex: 1; }}
table {{ width: 100%; border-collapse: collapse; margin-top: 3mm; }}
th, td {{ border-bottom: 1px solid #e3e7ef; padding: 1.6mm 2mm; text-align: right; }}
th {{ background: #f1f4f9; font-weight: 700; }} thead {{ display: table-header-group; }}
.tot td {{ font-weight: 700; font-size: 12pt; border-top: 2px solid #1d2433; }}
.muted {{ color: #667; font-size: 8.5pt; }} .grid {{ page-break-inside: auto; }} tr {{ page-break-inside: avoid; }}
</style></head><body>
<header><div><h1>חשבון צריכת חשמל ודרישת תשלום</h1><div class=muted>אינו חשבונית מס</div></div>
<div><b>{E(BUSINESS['name'])}</b><br>{E(BUSINESS['reg'])}<br>{E(BUSINESS['address'])}<br>
<span class=n>{E(BUSINESS['phone'])}</span> · <span class=n>{E(BUSINESS['email'])}</span></div></header>
<div class=two><div class=box><b>לכבוד</b><br>{E(CUSTOMER['name'])}<br>{E(CUSTOMER['address'])}<br>
מספר לקוח: <span class=n>{E(CUSTOMER['number'])}</span><br>חשבון: {E(CUSTOMER['account'])}</div>
<div class=box>מספר חשבון: <b class=n>2026-09-0001</b><br>תאריך הפקה: <span class=n>02.10.2026</span><br>
תקופה: <span class=n>01.09.2026</span> - <span class=n>30.09.2026</span> (30 ימים)<br>לתשלום עד: <span class=n>16.10.2026</span></div></div>
<table><thead><tr><th>מונה</th><th>קריאה בתחילת התקופה</th><th>קריאה בסוף התקופה</th><th>צריכה (קוט״ש)</th><th>חלק</th><th>לחיוב (קוט״ש)</th></tr></thead>
<tbody>{''.join(rows)}</tbody></table>
<div class=muted>נוסחת החשבון: לוח סטודיו + 30% × תאורת לובי</div>
<table><thead><tr><th>פירוט</th><th>כמות</th><th>מחיר ליחידה</th><th>סכום (₪)</th></tr></thead><tbody>
<tr><td>צריכת חשמל</td><td class=n>{total_kwh:,.2f} קוט״ש</td><td class=n>{PRICE_EX_VAT:.4f} ₪</td><td class=n>{money(amount)}</td></tr>
<tr><td>סה״כ לפני מע״מ</td><td></td><td></td><td class=n>{money(amount)}</td></tr>
<tr><td>מע״מ {int(VAT * 100)}%</td><td></td><td></td><td class=n>{money(vat)}</td></tr>
<tr class=tot><td>סה״כ לתשלום</td><td></td><td></td><td class=n>{money(total)} ₪</td></tr></tbody></table>
<div class=box>{E(NOTE)}</div>
<p class=muted>המחיר הוזן לפני מע״מ. הקריאות הן קריאות מונה מצטברות שנמדדו בפועל.</p>
{''.join(days)}
</body></html>"""


def render(name, appendix, runs=5):
    src = bill_html(appendix)
    times = []
    for i in range(runs):
        t = time.perf_counter()
        doc = HTML(string=src, base_url=HERE, url_fetcher=locked_fetcher()).render()
        pdf = doc.write_pdf()
        times.append(round(time.perf_counter() - t, 3))
    out = os.path.join(HERE, name)
    with open(out, "wb") as fh:
        fh.write(pdf)
    return {"file": name, "pages": len(doc.pages), "bytes": len(pdf), "seconds_each": times}


if __name__ == "__main__":
    res = {"weasyprint": weasyprint.__version__, "python": sys.version.split()[0], "import_s": round(IMPORT_S, 3)}
    res["one_page"] = render("sample-1p.pdf", 0)
    res["three_page"] = render("sample-3p.pdf", 3)
    # fetcher probe: raw (unescaped) remote and local references must be refused, the render must still finish
    probe = ('<html><body><img src="http://example.invalid/x.png"><img src="file:///etc/hostname">'
             '<div style="background:url(https://example.invalid/b.png)">x</div></body></html>')
    HTML(string=probe, base_url=HERE, url_fetcher=locked_fetcher()).write_pdf()
    res["blocked_urls"] = sorted(set(BLOCKED))
    res["max_rss_mb"] = round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024, 1)
    print(json.dumps(res, ensure_ascii=False, indent=1))
