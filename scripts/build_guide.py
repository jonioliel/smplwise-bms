#!/usr/bin/env python3
"""Build docs/user-guide/he/GUIDE_ALL_HE.html - the whole Hebrew user guide as ONE browsable, printable page (T091).

    python scripts/build_guide.py [--check]

Reads the guide's pages (docs/user-guide/he/NN-*_HE.md, in file-name order; README_HE.md documents the screenshot
tooling and is left out), converts them with a small built-in Markdown converter (stdlib only - headings,
paragraphs, nested bullet/numbered lists, block quotes, tables, fenced code, inline code, bold/italic, links and
images), and writes one self-contained RTL HTML file with a table of contents. Images stay relative (img/...), so
the file is read from its folder in the repository (or a copy of the folder). Links between pages
(`[..](20-map_HE.md)`) become in-page anchors.

--check exits 1 when the committed file differs from what the pages produce (for a release checklist).
Both modes also report (and exit 1 on) platform branding in the operator chapters - see OPERATOR_PAGES.
"""
from __future__ import annotations

import html
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GUIDE = ROOT / "docs" / "user-guide" / "he"
OUT = GUIDE / "GUIDE_ALL_HE.html"
PAGE_RE = re.compile(r"^\d{2}-[\w-]+_HE\.md$")


def page_id(name: str) -> str:
    return "p-" + name.removesuffix("_HE.md")


# ---------------------------------------------------------------------------------------------------------------
# Inline

def inline(text: str, pages: dict[str, str]) -> str:
    """Inline Markdown -> HTML. Code spans are cut out first so nothing inside them is interpreted."""
    parts = re.split(r"(`[^`]+`)", text)
    out = []
    for part in parts:
        if len(part) >= 2 and part.startswith("`") and part.endswith("`"):
            code = part[1:-1]
            target = pages.get(Path(code).name)
            if target:  # a page named as code (`20-map_HE.md`) is a link to it
                out.append(f'<a href="#{target}"><code>{html.escape(code)}</code></a>')
            else:
                out.append(f"<code>{html.escape(code)}</code>")
            continue
        s = html.escape(part, quote=False)

        def img(m: re.Match) -> str:
            alt, src = m.group(1), m.group(2)
            return f'<img src="{html.escape(src)}" alt="{html.escape(alt)}" loading="lazy">'

        def link(m: re.Match) -> str:
            label, href = m.group(1), m.group(2)
            base, _, frag = href.partition("#")
            target = pages.get(Path(base).name) if base else None
            if target:
                href = f"#{target}"
            elif base.endswith(".md") and not base.startswith("http"):
                return label  # a repository document outside the guide: keep the text, drop the dead link
            return f'<a href="{html.escape(href)}">{label}</a>'

        s = re.sub(r"!\[([^\]]*)\]\(([^)\s]+)\)", img, s)
        s = re.sub(r"\[([^\]]+)\]\(([^)\s]+)\)", link, s)
        s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
        s = re.sub(r"(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])", r"<em>\1</em>", s)
        out.append(s)
    return "".join(out)


# ---------------------------------------------------------------------------------------------------------------
# Blocks

LIST_RE = re.compile(r"^(\s*)([-*+]|\d+[.)])\s+(.*)$")


def convert(md: str, pages: dict[str, str], pid: str, toc: list[tuple[int, str, str]]) -> str:
    lines = [ln for ln in md.splitlines() if not re.match(r"^Source:\s", ln)]
    out: list[str] = []
    i = 0
    hcount = 0

    def para(buf: list[str]) -> None:
        if buf:
            out.append(f"<p>{inline(' '.join(s.strip() for s in buf), pages)}</p>")
            buf.clear()

    buf: list[str] = []
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            para(buf)
            i += 1
            continue
        m = re.match(r"^(#{1,6})\s+(.*)$", line)
        if m:
            para(buf)
            level = len(m.group(1))
            hcount += 1
            hid = pid if level == 1 else f"{pid}-{hcount}"
            text = m.group(2).strip()
            if level <= 2:
                toc.append((level, hid, re.sub(r"`", "", text)))
            out.append(f'<h{level} id="{hid}">{inline(text, pages)}</h{level}>')
            i += 1
            continue
        if line.lstrip().startswith("```"):
            para(buf)
            j = i + 1
            code = []
            while j < len(lines) and not lines[j].lstrip().startswith("```"):
                code.append(lines[j])
                j += 1
            out.append(f'<pre dir="ltr"><code>{html.escape(chr(10).join(code))}</code></pre>')
            i = j + 1
            continue
        if line.startswith(">"):
            para(buf)
            quote = []
            while i < len(lines) and lines[i].startswith(">"):
                quote.append(re.sub(r"^>\s?", "", lines[i]))
                i += 1
            out.append(f"<blockquote>{convert(chr(10).join(quote), pages, pid + '-q' + str(i), [])}</blockquote>")
            continue
        if line.lstrip().startswith("|") and i + 1 < len(lines) and re.match(r"^\s*\|[\s:|-]+\|\s*$", lines[i + 1]):
            para(buf)
            rows = []
            while i < len(lines) and lines[i].lstrip().startswith("|"):
                rows.append(lines[i])
                i += 1
            cells = lambda r: [c.strip() for c in r.strip().strip("|").split("|")]  # noqa: E731
            head = "".join(f"<th>{inline(c, pages)}</th>" for c in cells(rows[0]))
            body = "".join("<tr>" + "".join(f"<td>{inline(c, pages)}</td>" for c in cells(r)) + "</tr>" for r in rows[2:])
            out.append(f'<div class="table"><table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table></div>')
            continue
        if LIST_RE.match(line):
            para(buf)
            i = render_list(lines, i, out, pages)
            continue
        if re.match(r"^\s*(-{3,}|\*{3,})\s*$", line):
            para(buf)
            out.append("<hr>")
            i += 1
            continue
        buf.append(line)
        i += 1
    para(buf)
    return "\n".join(out)


def render_list(lines: list[str], i: int, out: list[str], pages: dict[str, str]) -> int:
    """A (possibly nested) list starting at lines[i]; returns the index after it."""
    m = LIST_RE.match(lines[i])
    assert m
    indent = len(m.group(1))
    ordered = m.group(2)[0].isdigit()
    start = int(re.match(r"\d+", m.group(2)).group()) if ordered else 1
    tag = "ol" if ordered else "ul"
    out.append(f'<{tag}{f" start={start}" if ordered and start != 1 else ""}>')
    while i < len(lines):
        m = LIST_RE.match(lines[i])
        if not m or len(m.group(1)) != indent or m.group(2)[0].isdigit() != ordered:
            break
        item = [m.group(3)]
        i += 1
        children: list[str] = []
        while i < len(lines):
            ln = lines[i]
            if not ln.strip():
                # a blank line ends the item unless the next line is still indented under it
                if i + 1 < len(lines) and lines[i + 1].strip() and len(lines[i + 1]) - len(lines[i + 1].lstrip()) > indent:
                    i += 1
                    continue
                break
            sub = LIST_RE.match(ln)
            lead = len(ln) - len(ln.lstrip())
            if sub and len(sub.group(1)) > indent:
                i = render_list(lines, i, children, pages)
                continue
            if lead > indent and not sub:
                if children:  # text after a nested list: a new paragraph inside the item
                    children.append(f"<p>{inline(ln.strip(), pages)}</p>")
                else:
                    item.append(ln.strip())
                i += 1
                continue
            break
        out.append(f"<li>{inline(' '.join(item), pages)}{''.join(children)}</li>")
    out.append(f"</{tag}>")
    return i


# ---------------------------------------------------------------------------------------------------------------

CSS = """
:root { --fg:#1b2330; --muted:#5b6678; --line:#dde3ec; --bg:#ffffff; --soft:#f4f7fb; --accent:#1f6feb; }
@media (prefers-color-scheme: dark) { :root { --fg:#e6ebf2; --muted:#9aa6b8; --line:#2c3644; --bg:#12171f; --soft:#1a212c; --accent:#6aa5ff; } }
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { margin:0; background:var(--bg); color:var(--fg); font:16px/1.7 "Segoe UI", "Assistant", "Heebo", Arial, sans-serif; }
.layout { display:grid; grid-template-columns: 300px minmax(0, 1fr); max-width: 1320px; margin: 0 auto; }
nav.toc { position: sticky; top:0; align-self:start; max-height:100vh; overflow:auto; padding:24px 16px; border-inline-end:1px solid var(--line); font-size:14px; }
nav.toc h2 { font-size:15px; margin:0 0 12px; }
nav.toc ol { list-style:none; margin:0; padding:0; }
nav.toc li { margin:2px 0; }
nav.toc li.l2 { padding-inline-start:14px; font-size:13px; }
nav.toc a { color:var(--fg); text-decoration:none; display:block; padding:2px 6px; border-radius:6px; }
nav.toc a:hover { background:var(--soft); color:var(--accent); }
main { padding: 24px 40px 80px; min-width:0; }
header.cover { padding: 16px 0 24px; border-bottom:1px solid var(--line); margin-bottom: 8px; }
header.cover h1 { margin:0; font-size:30px; }
header.cover p { margin:6px 0 0; color:var(--muted); }
section.page { padding-top: 12px; border-top: 1px solid var(--line); margin-top: 40px; }
section.page:first-of-type { border-top:0; margin-top:0; }
h1 { font-size:26px; margin: 18px 0 8px; } h2 { font-size:20px; margin: 28px 0 8px; } h3 { font-size:17px; margin: 22px 0 6px; }
a { color: var(--accent); }
code { background:var(--soft); border:1px solid var(--line); border-radius:4px; padding:0 4px; font-size:.9em; unicode-bidi: isolate; direction: ltr; }
pre { background:var(--soft); border:1px solid var(--line); border-radius:8px; padding:12px; overflow:auto; }
pre code { border:0; padding:0; background:none; }
blockquote { margin:12px 0; padding:8px 16px; border-inline-start:4px solid var(--accent); background:var(--soft); border-radius:6px; }
.table { overflow-x:auto; margin: 12px 0; }
table { border-collapse:collapse; width:100%; font-size:14px; }
th, td { border:1px solid var(--line); padding:6px 10px; text-align:start; vertical-align:top; }
th { background:var(--soft); }
img { display:block; max-width:100%; height:auto; margin: 16px auto 4px; border:1px solid var(--line); border-radius:8px; }
p > img + em, img + em { display:block; }
@media (max-width: 900px) { .layout { display:block; } nav.toc { position:static; max-height:none; border-inline-end:0; border-bottom:1px solid var(--line); } main { padding: 16px; } }
@media print {
  nav.toc { display:none; } .layout { display:block; } main { padding:0; }
  body { font-size:11pt; background:#fff; color:#000; }
  section.page { break-before: page; border-top:0; margin-top:0; }
  section.page:first-of-type { break-before: auto; }
  img { max-height: 16cm; object-fit: contain; break-inside: avoid; }
  a { color:#000; text-decoration:none; }
  h1, h2, h3 { break-after: avoid; }
}
"""


def build() -> str:
    names = sorted(p.name for p in GUIDE.iterdir() if PAGE_RE.match(p.name))
    pages = {n: page_id(n) for n in names}
    toc: list[tuple[int, str, str]] = []
    sections = []
    for n in names:
        md = (GUIDE / n).read_text(encoding="utf-8")
        body = convert(md, pages, pages[n], toc)
        sections.append(f'<section class="page" id="sec-{pages[n]}">\n{body}\n</section>')
    toc_html = "\n".join(f'<li class="l{lvl}"><a href="#{hid}">{html.escape(text)}</a></li>' for lvl, hid, text in toc)
    return f"""<!doctype html>
<!-- Generated by scripts/build_guide.py from docs/user-guide/he/*_HE.md - do not edit by hand; edit the pages and rebuild. -->
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>מדריך שימוש · SmplWise Arx</title>
<style>{CSS}</style>
</head>
<body>
<div class="layout">
<nav class="toc" aria-label="תוכן עניינים">
<h2>תוכן עניינים</h2>
<ol>
{toc_html}
</ol>
</nav>
<main>
<header class="cover">
<h1>מדריך שימוש · SmplWise Arx</h1>
<p>כל עמודי המדריך בקובץ אחד. להדפסה או לשמירה כ-PDF: Ctrl+P (כל עמוד מתחיל בדף חדש).</p>
</header>
{chr(10).join(sections)}
</main>
</div>
</body>
</html>
"""


# The operator chapters follow docs/design/UI_COPY_RULES.md: no platform branding. The installer / administrator
# chapters (60 backup, 70 setup wizard, 80 settings, 81 roles, 91 known limits, 95 troubleshooting), the glossary
# and the index may name the platform, as the settings screens themselves do.
OPERATOR_PAGES = ("10-", "20-", "21-", "30-", "31-", "32-", "40-", "41-", "42-", "43-", "50-", "85-")  # 32-: CR-010 alarm; 43-: CR-017 automations
BRAND_RE = re.compile(r"Home Assistant|\bHA\b|Supervisor|Ingress|\badd-on\b|Companion|HACS|תוסף", re.I)


def branding_hits() -> list[str]:
    hits = []
    for p in sorted(GUIDE.glob("*_HE.md")):
        if not p.name.startswith(OPERATOR_PAGES):
            continue
        for n, line in enumerate(p.read_text(encoding="utf-8").splitlines(), start=1):
            if BRAND_RE.search(re.sub(r"`[^`]*`", "", line)):  # identifiers in code spans (`ha.entity.control`) are not copy
                hits.append(f"{p.name}:{n}")
    return hits


def main(argv: list[str]) -> int:
    brand = branding_hits()
    for h in brand:
        print(f"platform branding in an operator chapter: {h}")
    text = build()
    if "--check" in argv[1:]:
        same = OUT.is_file() and OUT.read_text(encoding="utf-8") == text
        print("GUIDE_ALL_HE.html is up to date" if same else "GUIDE_ALL_HE.html is stale: run scripts/build_guide.py")
        return 0 if same and not brand else 1
    OUT.write_text(text, encoding="utf-8", newline="\n")
    print(f"wrote {OUT.relative_to(ROOT).as_posix()} ({len(text) // 1024} KB)")
    return 1 if brand else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
