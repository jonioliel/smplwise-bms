"""LEGAL-PACK-2291: build the Hebrew lawyer package - RTL HTML (with print CSS) + the Markdown sources + INDEX + SHA256SUMS + a ZIP.

Usage (from the repo root):  py -3.12 scripts/legalpack/build_html_pack.py [OUT_DIR]
Default OUT_DIR: private/legal-pack-2026-10-29 (gitignored). Nothing is sent anywhere; the script only reads the repository and writes OUT_DIR.
Excluded on purpose: the 18.10 proposed notice, the internal legal analysis/decisions/code spec, the English privacy files (offered on request),
the owner's open-questions file. A scan for IPv4 addresses, e-mail addresses and phone-like numbers runs over the output and fails the build on a hit.
"""
from __future__ import annotations

import hashlib
import html
import re
import shutil
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "private" / "legal-pack-2026-10-29"
PACK = ROOT / "docs" / "privacy" / "legal-pack"
PRIV = ROOT / "docs" / "privacy"

# (output name, source, title, what it is)
FILES = [
    ("00_cover_letter_he", PACK / "00_COVER_LETTER_HE.md", "מכתב פנייה", "מכתב הפנייה והשאלות C1-C17 ושאלות נוכחות העובדים"),
    ("01_legal_brief_technicians_he", PACK / "01_LEGAL_BRIEF_HE.md", "תדריך עובדתי: טכנאים חיצוניים", "תדריך על גישת טכנאים לדלתות, מעודכן ל-2.27.1"),
    ("02_employee_notice_v3_he", PACK / "02_EMPLOYEE_NOTICE_V3_FOR_COUNSEL_HE.md", "הודעה לעובדים (טיוטה)", "טיוטת הודעת נוכחות עובדים, עם הצעות ועובדות מהקוד"),
    ("03_privacy_readme", PRIV / "README.md", "מסמכי פרטיות: README", "רשימת השאלות C1-C17 ואי-ההתאמות בין קוד לנוסחים"),
    ("04_he_01_data_processing", PRIV / "he" / "01-data-processing-summary.md", "01 סיכום עיבוד נתונים", "מה נשמר, איפה, ולמי עובר"),
    ("05_he_02_retention_access", PRIV / "he" / "02-retention-and-access-summary.md", "02 שמירה וגישה", "מה נמחק לבד, מה ידני, מי רואה"),
    ("06_he_03_requests", PRIV / "he" / "03-data-subject-request-handling.md", "03 טיפול בבקשות", "צעדי טיפול בבקשות עיון, תיקון, מחיקה"),
    ("07_he_04_org_notice_template", PRIV / "he" / "04-organisation-privacy-notice-template.md", "04 תבנית הודעת פרטיות", "תבנית שהארגון ממלא"),
    ("08_he_05_database_definition_template", PRIV / "he" / "05-database-definition-and-incident-line-template.md", "05 תבנית הגדרות מאגר ואירוע", "תבנית מסמך הגדרות מאגר ושורת נוהל אירוע"),
    ("09_he_06_retention_policy_template", PRIV / "he" / "06-retention-policy-template.md", "06 תבנית מדיניות שמירה", "תבנית שהארגון ממלא"),
    ("10_technician_notice_final", PRIV / "technician-notice-final.md", "הודעה לטכנאים: נוסח סופי", "נוסח ההודעה בעברית, אנגלית, ערבית ורוסית"),
    ("99_changelog_he", PACK / "CHANGELOG_2026-10-29_HE.md", "יומן שינויים", "מה עודכן מאז 19.10 ומה לא אומת"),
]

CSS = """
:root{color-scheme:light}
html{direction:rtl}
body{font-family:Arial,"Segoe UI","David",sans-serif;line-height:1.6;max-width:880px;margin:24px auto;padding:0 16px;color:#111;background:#fff;font-size:15px}
h1{font-size:1.6em;border-bottom:2px solid #333;padding-bottom:6px}h2{font-size:1.3em;margin-top:1.6em}h3{font-size:1.1em}
table{border-collapse:collapse;width:100%;margin:12px 0;font-size:.9em}th,td{border:1px solid #999;padding:5px 7px;vertical-align:top;text-align:start}th{background:#eee}
code{font-family:Consolas,monospace;font-size:.88em;background:#f3f3f3;padding:0 3px;direction:ltr;unicode-bidi:isolate;word-break:break-all}
blockquote{border-inline-start:4px solid #999;margin:10px 0;padding:2px 12px;color:#333;background:#f8f8f8}
pre{direction:ltr;text-align:left;background:#f3f3f3;padding:8px;overflow:auto}
hr{border:0;border-top:1px solid #aaa}
.banner{border:2px solid #b00;padding:8px 12px;margin-bottom:16px;font-weight:bold}
@media print{body{max-width:none;margin:0;font-size:11pt}@page{size:A4;margin:18mm}tr,pre,blockquote{break-inside:avoid}h1,h2,h3{break-after:avoid}a{color:#000;text-decoration:none}}
"""

BANNER = "מסמך עובדתי שנכתב בצוות הפיתוח בסיוע סוכן Claude. אינו ייעוץ משפטי. לא נשלח לאיש."


def inline(s: str) -> str:
    s = html.escape(s, quote=False)
    s = re.sub(r"`([^`]+)`", lambda m: "<code>" + m.group(1) + "</code>", s)
    s = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"(?<![\w*])\*([^*\n]+)\*(?![\w*])", r"<em>\1</em>", s)
    s = re.sub(r"\[([^\]]+)\]\((https?://[^)]+)\)", r'<a href="\2">\1</a>', s)
    s = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"\1", s)  # relative links are dead inside the package: keep the text
    return s


def cells(line: str) -> list[str]:
    line = line.strip()
    if line.startswith("|"):
        line = line[1:]
    if line.endswith("|"):
        line = line[:-1]
    out, cur, tick = [], "", False
    for ch in line:
        if ch == "`":
            tick = not tick
        if ch == "|" and not tick:
            out.append(cur.strip())
            cur = ""
        else:
            cur += ch
    out.append(cur.strip())
    return out


def md_to_html(md: str) -> str:
    lines = md.replace("\r\n", "\n").split("\n")
    out: list[str] = []
    i = 0
    para: list[str] = []

    def flush() -> None:
        if para:
            out.append('<p dir="auto">' + inline(" ".join(p.strip() for p in para)) + "</p>")
            para.clear()

    while i < len(lines):
        ln = lines[i]
        if ln.strip().startswith("```"):
            flush()
            buf = []
            i += 1
            while i < len(lines) and not lines[i].strip().startswith("```"):
                buf.append(lines[i])
                i += 1
            out.append("<pre>" + html.escape("\n".join(buf)) + "</pre>")
            i += 1
            continue
        if not ln.strip():
            flush()
            i += 1
            continue
        m = re.match(r"^(#{1,4})\s+(.*)$", ln)
        if m:
            flush()
            n = len(m.group(1))
            out.append(f'<h{n} dir="auto">{inline(m.group(2))}</h{n}>')
            i += 1
            continue
        if re.match(r"^-{3,}\s*$", ln):
            flush()
            out.append("<hr>")
            i += 1
            continue
        if ln.lstrip().startswith("|") and i + 1 < len(lines) and re.match(r"^\s*\|?\s*:?-{2,}", lines[i + 1]):
            flush()
            head = cells(ln)
            i += 2
            rows = []
            while i < len(lines) and lines[i].lstrip().startswith("|"):
                rows.append(cells(lines[i]))
                i += 1
            t = ["<table><thead><tr>" + "".join(f'<th dir="auto">{inline(c)}</th>' for c in head) + "</tr></thead><tbody>"]
            for r in rows:
                t.append("<tr>" + "".join(f'<td dir="auto">{inline(c)}</td>' for c in r) + "</tr>")
            t.append("</tbody></table>")
            out.append("".join(t))
            continue
        if ln.startswith(">"):
            flush()
            buf = []
            while i < len(lines) and lines[i].startswith(">"):
                buf.append(lines[i][1:].strip())
                i += 1
            out.append('<blockquote dir="auto">' + inline(" ".join(buf)) + "</blockquote>")
            continue
        m = re.match(r"^(\s*)([-*]|\d+[.)])\s+(.*)$", ln)
        if m:
            flush()
            ordered = m.group(2)[0].isdigit()
            tag = "ol" if ordered else "ul"
            items: list[list] = []  # [indent, text]
            while i < len(lines):
                mm = re.match(r"^(\s*)([-*]|\d+[.)])\s+(.*)$", lines[i])
                if mm:
                    items.append([len(mm.group(1)), mm.group(3)])
                elif lines[i].strip() and lines[i].startswith("  ") and items:
                    items[-1][1] += " " + lines[i].strip()
                else:
                    break
                i += 1
            base = items[0][0]
            out.append(f"<{tag}>")
            depth = 0
            for ind, text in items:
                lvl = 1 if ind > base else 0
                while depth < lvl:
                    out.append("<ul>")
                    depth += 1
                while depth > lvl:
                    out.append("</ul>")
                    depth -= 1
                out.append(f'<li dir="auto">{inline(text)}</li>')
            while depth:
                out.append("</ul>")
                depth -= 1
            out.append(f"</{tag}>")
            continue
        para.append(ln)
        i += 1
    flush()
    return "\n".join(out)


def page(title: str, body: str) -> str:
    return (f'<!doctype html>\n<html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            f"<title>{html.escape(title)}</title><style>{CSS}</style></head><body>"
            f'<div class="banner" dir="rtl">{BANNER}</div>\n{body}\n</body></html>\n')


def sha(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def scan(path: Path) -> list[str]:
    t = path.read_text(encoding="utf-8", errors="replace")
    bad = []
    for name, rx in (("ipv4", r"\b(?:\d{1,3}\.){3}\d{1,3}\b"), ("email", r"[\w.+-]+@[\w-]+\.[\w.-]+"), ("phone", r"(?<![\w.:/`-])(?:\+972|05\d)[-\d ]{7,12}\b"),
                     ("mac", r"\b(?:[0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}\b")):
        for m in re.finditer(rx, t):
            s = m.group(0)
            if name == "ipv4" and (s.startswith(("0.", "127.")) or re.fullmatch(r"\d+\.\d+\.\d+\.\d+", s) and int(s.split(".")[0]) > 255):
                continue
            bad.append(f"{path.name}: {name}: {s}")
    return bad


def main() -> int:
    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT / "html").mkdir(parents=True)
    (OUT / "md").mkdir()
    idx_rows = []
    for name, src, title, what in FILES:
        text = src.read_text(encoding="utf-8")
        shutil.copyfile(src, OUT / "md" / f"{name}.md")
        (OUT / "html" / f"{name}.html").write_text(page(title, md_to_html(text)), encoding="utf-8", newline="\n")
        idx_rows.append((name, title, what))
    md = ["# SmplWise Arx - חבילת מסמכים ליועץ המשפטי (29.10.2026)", "",
          "**לא נשלח לאיש. אינו ייעוץ משפטי.** הדפסה: לפתוח כל קובץ ב-`html/` בדפדפן ולהדפיס (הגדרות ההדפסה כלולות בקובץ, A4). קובצי המקור ב-`md/`.", "",
          "| # | קובץ HTML | קובץ מקור | מה זה |", "|---|---|---|---|"]
    for n, (name, title, what) in enumerate(idx_rows):
        md.append(f"| {n} | `html/{name}.html` | `md/{name}.md` | {title}: {what} |")
    md += ["", "## הערות", "",
           "- הקישורים היחסיים בתוך המסמכים (למשל `../en/`) אינם פעילים בחבילה. הגרסאות באנגלית של מסמכי הפרטיות אינן מצורפות וזמינות לפי בקשה (האנגלית היא המקור הטכני של העברית).",
           "- לא מצורפים בכוונה: הנוסחים המוצעים מ-18.10 (הוחלפו בנוסח הסופי), הניתוח המשפטי הפנימי, קובצי ההחלטות הפנימיים ומפרט הקוד.",
           "- `SHA256SUMS` מפרט גיבוב של כל קובץ בחבילה (לא כולל את עצמו ואת קובץ ה-ZIP).",
           "- נתיבי הקוד שמצוינים במסמכים הם יחסיים למאגר `smplwisebms` ונבדקים לפי בקשה."]
    (OUT / "INDEX.md").write_text("\n".join(md) + "\n", encoding="utf-8", newline="\n")
    (OUT / "INDEX.html").write_text(page("אינדקס החבילה", md_to_html("\n".join(md))), encoding="utf-8", newline="\n")
    problems: list[str] = []
    for p in sorted(OUT.rglob("*")):
        if p.is_file():
            problems += scan(p)
    if problems:
        print("PRIVATE-DATA SCAN FAILED:\n" + "\n".join(problems))
        return 1
    files = sorted(p for p in OUT.rglob("*") if p.is_file())
    (OUT / "SHA256SUMS").write_text("".join(f"{sha(p)}  {p.relative_to(OUT).as_posix()}\n" for p in files), encoding="utf-8", newline="\n")
    zpath = OUT / "SmplWise_Legal_Pack_2026-10-29.zip"
    with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
        for p in sorted(p for p in OUT.rglob("*") if p.is_file() and p != zpath):
            z.write(p, p.relative_to(OUT).as_posix())
    print(f"built {len(files) + 1} files in {OUT}; zip sha256 {sha(zpath)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
