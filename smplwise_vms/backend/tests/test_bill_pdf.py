"""Electricity bill PDF (CR-023 P3): model limits, escaping, logo, chart, locked fetcher, golden renders, limits.

Layers: model / HTML / logo / chart tests are pure Python and always run. Render tests need WeasyPrint (and its Pango
libraries) plus poppler's pdftotext/pdfinfo/pdffonts (poppler-utils is part of the add-on image) and are skipped
with a reason where those are missing, never silently passed. All data is invented; the input is the billing snapshot v1.
"""
from __future__ import annotations

import copy
import io
import os
import re
import shutil
import subprocess
import sys
import time
from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))

import bill_pdf_samples as S  # noqa: E402
from smplwise.services import bill_pdf, bill_pdf_engine, bill_pdf_html  # noqa: E402
from smplwise.services.bill_pdf import BillPdfError, bill_pdf_filename, render_bill_pdf  # noqa: E402
from smplwise.services.bill_pdf_logo import LogoError, sanitize_logo  # noqa: E402
from smplwise.services.bill_pdf_model import BillSnapshot, BillSnapshotError, clean_text  # noqa: E402

try:
    import weasyprint  # noqa: F401
    HAVE_WEASY, WEASY_WHY = True, ""
except Exception as exc:  # missing package or missing Pango/GObject libraries
    HAVE_WEASY, WEASY_WHY = False, f"WeasyPrint not importable here: {type(exc).__name__}"
HAVE_POPPLER = all(shutil.which(t) for t in ("pdftotext", "pdfinfo", "pdffonts"))
# EL8: inside the add-on image (scripts/addon_image/check_bill_pdf.sh) a missing library must fail, never skip
REQUIRED = os.environ.get("SW_REQUIRE_BILL_PDF") == "1"
if REQUIRED:
    HAVE_WEASY = HAVE_POPPLER = True
needs_render = pytest.mark.skipif(not (HAVE_WEASY and HAVE_POPPLER),
                                  reason=WEASY_WHY or "poppler-utils (pdftotext/pdfinfo/pdffonts) not installed")
BIDI = re.compile("[\u200e\u200f\u202a-\u202e\u2066-\u2069]")


def snap(data: dict, **kw) -> BillSnapshot:
    return BillSnapshot.from_billing_snapshot(data, **kw)


# ---------------------------------------------------------------------------------------------- pdf helpers
def pdf_text(pdf: bytes, *extra: str) -> str:
    out = subprocess.run(["pdftotext", *extra, "-", "-"], input=pdf, capture_output=True, check=True).stdout.decode()
    return BIDI.sub("", out)


def flat(pdf: bytes) -> str:
    return " ".join(pdf_text(pdf).split())


def pdf_pages_text(pdf: bytes) -> list[str]:
    return [p for p in pdf_text(pdf).split("\f") if p.strip()]


def pdf_info(pdf: bytes) -> dict[str, str]:
    out = subprocess.run(["pdfinfo", "-"], input=pdf, capture_output=True, check=True).stdout.decode()
    return dict(line.split(":", 1) for line in out.splitlines() if ":" in line)


def pdf_fonts(pdf: bytes) -> list[list[str]]:
    out = subprocess.run(["pdffonts", "-"], input=pdf, capture_output=True, check=True).stdout.decode()
    return [line.split() for line in out.splitlines()[2:] if line.strip()]


@pytest.fixture(scope="module")
def base_pdf() -> bytes:
    return render_bill_pdf(S.base(), logo=S.logo_png())


# ================================================================================================ model
def test_model_reads_the_billing_snapshot():
    s = snap(S.base())
    assert s.days == 30 and s.total == Decimal("497.35") and s.number == "2026-09-0001" and s.mark is None
    assert s.meters[1].share_text == "30%" and s.meters[0].share_text == ""
    assert s.previous_kwh == Decimal("776.20") and len(s.history) == 11 and s.same_period_last_year.kwh == Decimal("702.10")
    assert len(s.snapshot_hash) == 12 and s.footer_note.startswith("התשלום")


def test_model_hash_is_the_documented_canonical_sha256():
    import hashlib
    import json

    raw = S.base()
    expected = hashlib.sha256(json.dumps(raw, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()).hexdigest()
    assert snap(raw).snapshot_hash == expected[:12]


def test_model_subtracted_and_fractional_coefficients():
    data = S.base()
    data["meters"][0]["coefficient"] = "-1"
    data["meters"][1]["coefficient"] = "-0.5"
    s = snap(data)
    assert s.meters[0].share_text == "\u2212" and s.meters[1].share_text == "\u221250%"


def test_model_local_time_of_the_last_report():
    s = snap(S.missing_report())
    assert s.meters[1].last_report.hour == 7 and s.meters[1].last_report.minute == 10  # 04:10 UTC = 07:10 in Israel
    assert "29.09.2026 07:10" in s.meters[1].report_note and s.meters[0].last_report is None


def mutate(path: str, value):
    data = copy.deepcopy(S.base())
    node = data
    keys = path.split(".")
    for k in keys[:-1]:
        node = node[int(k)] if k.isdigit() else node[k]
    node[keys[-1]] = value
    return data


@pytest.mark.parametrize("data,fragment", [
    (mutate("schema", "other/2"), "schema"),
    (mutate("bill.state", "paid"), "bill.state"),
    (mutate("bill.number", "x; DROP"), "bill.number"),
    (mutate("bill.number", None), "bill.number"),
    (mutate("bill.replaces", {"number": "<b>1</b>"}), "replaces"),
    (mutate("totals.total", "abc"), "totals.total"),
    (mutate("totals.total", "NaN"), "totals.total"),
    (mutate("period.to", "2026-08-01"), "period.to"),
    (mutate("period.from", "garbage"), "period.from"),
    (mutate("lines", []), "lines"),
    (mutate("customer.name", "  "), "customer.name"),
    (mutate("meters", {"a": 1}), "meters"),
    (mutate("notes", ["not an object"]), "notes"),
])
def test_model_refuses_bad_input(data, fragment):
    with pytest.raises(BillSnapshotError) as err:
        snap(data)
    assert fragment in str(err.value)


def test_model_refuses_unknown_watermark_and_non_mappings():
    with pytest.raises(BillSnapshotError):
        snap(S.base(), watermark="paid")
    with pytest.raises(BillSnapshotError):
        BillSnapshot.from_billing_snapshot([1, 2])  # type: ignore[arg-type]


def test_model_accepts_number_suffixes():
    for number in ("2026-12-0001", "2026-12-0001-2", "2026-12-0001/2", "2026-12-0001/2-2", "2026-12-12345"):
        assert snap(mutate("bill.number", number)).number == number


def test_model_caps_lines():
    with pytest.raises(BillSnapshotError):
        snap(S.big(401))
    assert len(snap(S.big(400)).meters) == 400


def test_a_draft_is_always_marked():
    assert snap(S.draft()).mark == "draft" and snap(S.draft(), watermark="copy").mark == "copy"
    assert snap(S.base(), watermark="void").mark == "void"


def test_clean_text_removes_controls_bidi_overrides_and_bounds_length():
    dirty = "אבג\u202eדהו\u0000\u0007\u2066x\u2069 \u200ey  z\r\n\tq"
    assert clean_text(dirty) == "אבגדהוx \u200ey z q"
    assert len(clean_text("x" * 500, 50)) == 50
    assert clean_text("a\n\n\n\nb", 50, multiline=True) == "a\n\nb"
    assert clean_text(None) == ""


def test_floats_are_accepted_but_decimal_strings_are_exact():
    assert snap(mutate("totals.total", 497.35)).total == Decimal("497.35")


# ================================================================================================ filename
def test_filename_is_ascii_and_built_from_the_number_only():
    assert bill_pdf_filename("2026-12-0001") == "bill-2026-12-0001.pdf"
    assert bill_pdf_filename("2026-12-0001-2") == "bill-2026-12-0001-2.pdf"
    assert bill_pdf_filename("2026-12-0001/2-2") == "bill-2026-12-0001_2-2.pdf"
    assert bill_pdf_filename(None) == "bill-draft.pdf"
    for hostile in ("../../etc/passwd", "2026-12-0001\r\nX: y", 'a"b', "חשבון-1", "2026/12/1", "2026-12-0001\n"):
        name = bill_pdf_filename(hostile)
        assert name == "bill-draft.pdf" and name.isascii()


# ================================================================================================ logo
def png_with_text_chunk() -> bytes:
    from PIL import PngImagePlugin

    info = PngImagePlugin.PngInfo()
    info.add_text("Author", "secret-author-name")
    out = io.BytesIO()
    Image.new("RGB", (40, 30), (1, 2, 3)).save(out, format="PNG", pnginfo=info)
    return out.getvalue()


def test_logo_png_is_reencoded_without_metadata_and_scaled():
    raw = png_with_text_chunk()
    assert b"secret-author-name" in raw
    clean = sanitize_logo(raw)
    assert clean.startswith(b"\x89PNG") and b"secret-author-name" not in clean
    big = io.BytesIO()
    Image.new("RGB", (2400, 1200), (9, 9, 9)).save(big, format="PNG")
    with Image.open(io.BytesIO(sanitize_logo(big.getvalue()))) as img:
        assert img.size == (800, 400)


def test_logo_jpeg_with_exif_is_accepted_and_exif_dropped():
    out = io.BytesIO()
    exif = Image.Exif()
    exif[0x010E] = "private description"
    Image.new("RGB", (64, 64), (200, 10, 10)).save(out, format="JPEG", exif=exif)
    clean = sanitize_logo(out.getvalue())
    assert clean.startswith(b"\x89PNG") and b"private description" not in clean


def test_logo_transparency_is_kept():
    out = io.BytesIO()
    Image.new("RGBA", (20, 20), (1, 2, 3, 0)).save(out, format="PNG")
    with Image.open(io.BytesIO(sanitize_logo(out.getvalue()))) as img:
        assert img.mode == "RGBA" and img.getpixel((0, 0))[3] == 0


@pytest.mark.parametrize("data,code", [
    (b"", "logo_empty"),
    (b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', "logo_type"),
    (b"GIF89a" + b"\0" * 40, "logo_type"),
    (b"%PDF-1.4 hostile", "logo_type"),
    (b"\x89PNG\r\n\x1a\n" + b"junk" * 10, "logo_undecodable"),
    (b"\xff\xd8\xff" + b"junk" * 10, "logo_undecodable"),
    (b"\x89PNG\r\n\x1a\n" + b"0" * 1_000_001, "logo_too_large"),
])
def test_logo_refusals(data, code):
    with pytest.raises(LogoError) as err:
        sanitize_logo(data)
    assert str(err.value) == code


def test_logo_decompression_bomb_is_refused():
    out = io.BytesIO()
    Image.new("1", (6000, 6000)).save(out, format="PNG")  # 36 million pixels, a few KB on the wire
    assert len(out.getvalue()) < 1_000_000
    with pytest.raises(LogoError) as err:
        sanitize_logo(out.getvalue())
    assert str(err.value) == "logo_dimensions"


# ================================================================================================ html safety
HOSTILE = ('<script>alert(1)</script><img src="http://example.invalid/x.png" onerror=alert(1)>"\'&amp; '
           'url(http://example.invalid/a) {{7*7}} ${x}')


def hostile_snapshot() -> dict:
    data = S.base()
    data["customer"].update(name=HOSTILE, address=HOSTILE, customer_number=HOSTILE)
    data["account"].update(name=HOSTILE, tariff={"name": HOSTILE}, formula={"sentence_he": HOSTILE})
    data["business"].update(name=HOSTILE, address=HOSTILE, phone=HOSTILE, email=HOSTILE, registration_no=HOSTILE,
                            footer_note=HOSTILE, accent_color='#2767ed;}</style><script>alert(1)</script>')
    data["totals"]["price_mode_note_he"] = HOSTILE
    data["doc"] = {"title_he": HOSTILE, "subtitle_he": HOSTILE}
    data["notes"] = [{"code": "x", "text_he": HOSTILE}]
    for m in data["meters"]:
        m["name"] = HOSTILE
    return data


def test_html_escapes_everything_a_person_typed():
    html = bill_pdf_html.build_html(snap(hostile_snapshot()), has_logo=False)
    assert "<script" not in html.lower()
    assert "<img" not in html  # no logo, so no image tag at all
    assert "&lt;script&gt;alert(1)&lt;/script&gt;" in html
    assert "&lt;img src=&quot;http://example.invalid/x.png&quot;" in html
    assert "</style><script>" not in html  # the accent colour is validated, the CSS cannot be closed from the data


def test_html_references_only_bundled_names():
    html = bill_pdf_html.build_html(snap(hostile_snapshot()), has_logo=True)
    urls = set(re.findall(r'url\("([^"]+)"\)', html)) | set(re.findall(r'src="([^"]+)"', html))
    allowed = {bill_pdf_html.ASSET_SCHEME + f for f in bill_pdf_html.FONT_FILES} | {bill_pdf_html.LOGO_URL}
    assert urls and urls <= allowed
    css = html.split("<style>")[1].split("</style>")[0]
    assert "http" not in css and "file:" not in css and "data:" not in css


def test_bidi_override_characters_never_reach_the_html():
    data = S.base()
    data["customer"]["name"] = "דנה\u202eלוי"
    assert "\u202e" not in bill_pdf_html.build_html(snap(data), False)


def test_watermark_marks():
    draft = bill_pdf_html.build_html(snap(S.draft()), False)
    assert 'class="wm "' in draft and "טיוטה" in draft
    assert 'class="wm void"' in bill_pdf_html.build_html(snap(S.base(), watermark="void"), False)
    assert "העתק" in bill_pdf_html.build_html(snap(S.base(), watermark="copy"), False)
    assert 'class="wm' not in bill_pdf_html.build_html(snap(S.base()), False)


def test_readings_print_up_to_three_places_and_trim_one_trailing_zero():
    assert bill_pdf_html.reading(Decimal("12480.620")) == "12,480.62"
    assert bill_pdf_html.reading(Decimal("12345.678")) == "12,345.678"
    assert bill_pdf_html.reading(Decimal("7")) == "7.00"


# ================================================================================================ chart
def bar_rects(html: str) -> int:
    return len(re.findall(r"<rect x=", html))


def chart(data: dict) -> str:
    return bill_pdf_html.chart_section(snap(data))


def hist(prev, last_year=None):
    return S.with_history(prev, last_year)


def test_chart_present_with_previous_periods_current_and_last_year():
    html = chart(S.base())
    assert 'class="chart"' in html and "צריכה בתקופות קודמות" in html
    assert bar_rects(html) == 11 + 1 + 1  # 11 history points in the sample + current + last year
    assert "אותה תקופה אשתקד" in html and "stroke-dasharray" in html
    assert 'role="img"' in html and "<title>" in html and 'class="mini"' in html  # accessible text and table


def test_chart_trims_to_the_twelve_latest_previous_periods():
    rows = [(f"{2024 + i // 12}-{i % 12 + 1:02d}-01", f"{2024 + i // 12}-{i % 12 + 1:02d}-28", str(100 + i)) for i in range(20)]
    html = chart(hist(S.previous(rows)))
    assert bar_rects(html) == 12 + 1
    assert ">100<" not in html and ">119<" in html  # oldest dropped, newest kept


def test_chart_omitted_when_there_is_nothing_to_compare():
    assert chart(S.no_history()) == ""
    nulls = [{"from": "2026-08-01", "to": "2026-08-31", "kwh": None, "status": "missing", "source": None}]
    assert chart(hist(nulls)) == ""
    not_past = S.previous([("2026-09-01", "2026-09-30", "700"), ("2026-10-01", "2026-10-31", "800"),
                           ("2026-01-01", "2026-01-31", "-5")])  # overlaps, follows, negative: none of these is history
    assert chart(hist(not_past)) == ""
    assert chart(S.base() | {"history": None}) == ""


def test_chart_partial_data_draws_only_what_exists():
    one = S.previous([("2026-08-01", "2026-08-31", "812.4")])
    html = chart(hist(one))
    assert bar_rects(html) == 2 and "אותה תקופה אשתקד" not in html and "stroke-dasharray" not in html
    only_ly = chart(hist([], S.LAST_YEAR))
    assert bar_rects(only_ly) == 2 and "אותה תקופה אשתקד" in only_ly
    gap = S.previous([("2026-03-01", "2026-03-31", "655"), ("2026-06-01", "2026-06-30", "845.3")])  # April, May missing
    assert bar_rects(chart(hist(gap))) == 3  # no invented bars
    missing_mid = S.previous([("2026-03-01", "2026-03-31", "655")]) + [
        {"from": "2026-04-01", "to": "2026-04-30", "kwh": None, "status": "missing", "source": None}]
    assert bar_rects(chart(hist(missing_mid))) == 2


def test_chart_marks_partial_values_as_lower_bounds():
    rows = S.previous([("2026-07-01", "2026-07-31", "500")], status="partial") + S.previous([("2026-08-01", "2026-08-31", "700")])
    html = chart(hist(rows))
    assert ">500+<" in html and ">700<" in html and "נתונים חלקיים" in html
    assert "נתונים חלקיים" not in chart(S.base())


def test_chart_long_labels_irregular_periods_and_zero_values():
    rows = [("2025-11-16", "2026-01-15", "1204.5"), ("2026-01-16", "2026-03-15", "0"), ("2026-03-16", "2026-07-15", "99999.99")]
    html = chart(hist(S.previous(rows)))
    assert "16.11.2025" in html and "15.01.2026" in html  # full from-to range in the number table
    assert ">01.26<" in html and ">100,000<" in html  # 99999.99 rounds to 100,000 in the chart label
    zero = S.with_history(S.previous([("2026-08-01", "2026-08-31", "0")]), None)
    zero["history"]["current"]["kwh"] = "0"
    zero["totals"]["kwh"] = "0"
    assert 'height="0.0"' in chart(zero)  # zero is drawn as no bar, never a negative or NaN height


def test_chart_values_scale_to_the_largest_bar():
    s = snap(S.base())
    html = bill_pdf_html.chart_svg(s, *bill_pdf_html.chart_series(s))
    heights = [float(h) for h in re.findall(r'<rect x="[^"]+" y="[^"]+" width="[^"]+" height="([^"]+)"', html)]
    assert max(heights) <= 104 - 22 - 22 + 0.1 and min(heights) > 0


def test_chart_value_labels_get_a_plate_only_where_the_reference_line_runs():
    """EL8 visual review: the dashed last-year line struck through value labels of bars of about the same height."""
    with_ly = chart(S.base())
    assert with_ly.count('class="vbg"') == 11 + 1 + 1
    assert chart(hist(S.previous([("2026-08-01", "2026-08-31", "812.4")]))).count('class="vbg"') == 0


# ================================================================================================ logo box
@pytest.mark.parametrize("size, box", [((400, 120), (34.0, 10.2)), ((120, 400), (5.1, 17.0)), ((100, 100), (17.0, 17.0)),
                                       ((800, 100), (34.0, 4.25)), ((50, 25), (34.0, 17.0)), (None, None), ((0, 10), None)])
def test_logo_box_keeps_the_aspect_ratio_inside_the_header_box(size, box):
    assert bill_pdf_html.logo_box_mm(size) == box


def test_logo_size_is_printed_as_computed_numbers_only():
    html = bill_pdf_html.build_html(snap(S.base()), True, (400, 120))
    assert '<img class="logo" src="bill-logo:logo.png" alt="" style="width: 34.00mm; height: 10.20mm">' in html
    assert '<img class="logo" src="bill-logo:logo.png" alt="">' in bill_pdf_html.build_html(snap(S.base()), True)


def _png(w: int, h: int) -> bytes:
    img = Image.new("RGB", (w, h), (200, 30, 160))  # magenta: nothing else on the bill has this colour
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return buf.getvalue()


@needs_render
@pytest.mark.parametrize("w, h", [(400, 120), (800, 60), (120, 400), (300, 300)])
def test_logo_of_any_shape_stays_inside_the_page_margins(w, h, tmp_path):
    """EL8 visual review: a wide logo was drawn 17 mm high with its natural width and ran off the left edge of the page."""
    pdf = render_bill_pdf(S.base(), logo=_png(w, h))
    (tmp_path / "b.pdf").write_bytes(pdf)
    subprocess.run(["pdftoppm", "-r", "50", "-f", "1", "-l", "1", "-png", "-singlefile", str(tmp_path / "b.pdf"), str(tmp_path / "p")],
                   check=True)
    with Image.open(tmp_path / "p.png") as img:
        page = img.convert("RGB")
    px_per_mm = page.width / 210
    margin = int(12 * px_per_mm)  # the page margin is 14 mm left and right; nothing may be drawn in the outer 12 mm
    header = page.crop((0, 0, page.width, int(45 * px_per_mm)))
    for x0, x1 in ((0, margin), (header.width - margin, header.width)):
        strip = header.crop((x0, 0, x1, header.height))
        assert all(c == (255, 255, 255) for _n, c in strip.getcolors(maxcolors=1 << 16)), (w, h, x0)
    logo_px = sum(n for n, c in header.getcolors(maxcolors=1 << 16) if c[0] > 150 and c[1] < 90 and c[2] > 110)
    assert logo_px > 0, "the logo is drawn"


# ================================================================================================ fetcher
@pytest.mark.skipif(not HAVE_WEASY, reason=WEASY_WHY)
def test_locked_fetcher_serves_only_bundled_assets_and_the_logo():
    f = bill_pdf_engine.LockedFetcher(S.logo_png())
    for name in bill_pdf_html.FONT_FILES:
        assert f.fetch(bill_pdf_html.ASSET_SCHEME + name).read()[:4] in (b"\x00\x01\x00\x00", b"true", b"OTTO")
    assert f.fetch(bill_pdf_html.LOGO_URL).read().startswith(b"\x89PNG")
    hostile = ["http://example.invalid/x", "https://example.invalid/x", "file:///etc/passwd", "ftp://example.invalid/x",
               "data:text/html,<script>1</script>", "data:image/png;base64,AAAA", "//example.invalid/x", "x.png",
               "bill-asset:../../etc/passwd", "bill-asset:Heebo-he-400.ttf/../../x", "bill-asset:evil.ttf",
               "bill-asset:", "bill-logo:other.png", "javascript:alert(1)"]
    for url in hostile:
        with pytest.raises(ValueError):
            f.fetch(url)
    assert len(f.blocked) == len(hostile)
    with pytest.raises(ValueError):
        bill_pdf_engine.LockedFetcher(None).fetch(bill_pdf_html.LOGO_URL)  # no logo given: not even that name


@pytest.mark.skipif(not HAVE_WEASY, reason=WEASY_WHY)
def test_weasyprint_never_gets_a_resource_outside_the_allow_list():
    from weasyprint import HTML

    f = bill_pdf_engine.LockedFetcher(None)
    page = ('<html><body><img src="http://example.invalid/a.png"><div style="background:url(https://example.invalid/b.png)">'
            '</div><link rel="stylesheet" href="file:///etc/hostname"><img src="data:image/png;base64,AAAA"></body></html>')
    HTML(string=page, base_url=None, url_fetcher=f).render()
    assert len(f.blocked) >= 3 and all("example.invalid" in u or u.startswith(("file:", "data:")) for u in f.blocked)


def test_deny_network_blocks_sockets_in_the_worker_process():
    code = ("from smplwise.services.bill_pdf_engine import deny_network; import socket; deny_network()\n"
            "for call in (lambda: socket.create_connection(('example.invalid', 80)), lambda: socket.getaddrinfo('a.invalid', 80),\n"
            "             lambda: socket.socket().connect(('127.0.0.1', 9))):\n"
            "    try: call()\n"
            "    except PermissionError: pass\n"
            "    else: raise SystemExit('network call was allowed')\n"
            "print('denied')")
    out = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True, cwd=bill_pdf._PACKAGE_PARENT)
    assert out.returncode == 0 and "denied" in out.stdout, out.stderr


# ================================================================================================ golden renders
@needs_render
def test_golden_base_bill_is_one_a4_page_with_embedded_heebo(base_pdf):
    info = pdf_info(base_pdf)
    assert info["Pages"].strip() == "1"
    assert re.match(r"\s*595\.\d+ x 841\.\d+ pts \(A4\)", info["Page size"])
    fonts = pdf_fonts(base_pdf)
    assert fonts and all("Heebo" in f[0] for f in fonts)
    assert all(f[4] == "yes" for f in fonts)  # emb column: every font is embedded
    assert base_pdf.startswith(b"%PDF-") and len(base_pdf) < 120_000
    assert b"/Subtype /Image" in base_pdf or b"/Subtype/Image" in base_pdf  # the logo


@needs_render
def test_golden_text_content_and_order(base_pdf):
    text = pdf_text(base_pdf)
    # logical (reading) order inside each phrase, as pdftotext reports it
    for token in ["חשבון צריכת חשמל ודרישת תשלום", "אינו חשבונית מס", "2026-09-0001", "02.10.2026", "לכבוד", "סטודיו אורן לעיצוב",
                  "תקופת החיוב", "01.09.2026", "30.09.2026", "ימים", "16.10.2026", "סה״כ לתשלום", "497.35", "לוח סטודיו",
                  "12,480.62", "13,166.10", "685.48", "תאורת לובי", "30%", "90.72", "צריכת חשמל", "0.5430", "421.48", "75.87",
                  "מע״מ 18%", "צריכה בתקופות קודמות", "812", "הקריאות הן קריאות מונה מצטברות", "התשלום בהעברה בנקאית",
                  "SmplWise Arx"]:
        assert token in text, token
    # top-to-bottom order of the sections, from word positions
    words = bbox_text_words(base_pdf)

    def first_y(word: str) -> float:
        return min(w[1] for w in words if w[4].rstrip(":") == word)

    anchors = ["לכבוד", "מונה", "פירוט", "קודמות", "הקריאות", "הערות"]
    ys = [first_y(a) for a in anchors]
    assert ys == sorted(ys) and len(set(ys)) == len(ys), dict(zip(anchors, ys))
    assert first_y("אינו") > first_y("חשבון") and first_y("לכבוד") > first_y("2026-09-0001")
    assert re.search(r"עמוד\s*1\s*מתוך\s*1", text)


@needs_render
def test_golden_numbers_and_dates_keep_their_digit_order(base_pdf):
    text = pdf_text(base_pdf)
    for token in ("2026-09-0001", "497.35", "421.48", "75.87", "0.5430", "776.20", "03-0000000", "billing@example.co.il",
                  "01.09.2026", "30.09.2026", "₪"):
        assert token in text, token
    for reversed_token in ("1000-90-6202", "53.794", "84.124"):
        assert reversed_token not in text


@needs_render
def test_golden_draft_void_copy_revision_and_missing_report():
    draft = flat(render_bill_pdf(S.draft()))
    assert "טיוטה" in draft and "2026-09-0001" not in draft
    void = flat(render_bill_pdf(S.base(), watermark="void"))
    assert "בוטל" in void and "חשבון זה בוטל ואינו בתוקף" in void
    assert "העתק" in flat(render_bill_pdf(S.base(), watermark="copy"))
    rev = flat(render_bill_pdf(S.revision()))
    assert "2026-09-0001-2" in rev and "מחליף את" in rev and "חשבון מתוקן" in rev
    miss = flat(render_bill_pdf(S.missing_report()))
    assert "תאורת לובי *" in miss and "תחויב בחיוב הבא" in miss
    assert re.search(r"לא מדווח מאז\s*\.?29\.09\.2026 07:10", miss)  # the date and time stay together, in that order
    assert "30.09.2026 23:55" in miss
    assert "קריאת סוף התקופה של לוח סטודיו" in miss  # the server's other notes are printed too


@needs_render
def test_golden_missing_report_without_a_server_note_still_states_the_last_report_date():
    data = S.missing_report()
    data["notes"] = []
    text = flat(render_bill_pdf(data))
    assert "לא דיווח" in text and "29.09.2026 07:10" in text and "החיוב כולל רק מה שנמדד" in text


@needs_render
def test_golden_chart_present_and_absent_in_the_pdf():
    with_chart = pdf_text(render_bill_pdf(S.base()))
    assert "צריכה בתקופות קודמות" in with_chart and "845" in with_chart and "702" in with_chart and "אשתקד" in with_chart
    without = pdf_text(render_bill_pdf(S.no_history()))
    assert "צריכה בתקופות קודמות" not in without and "אשתקד" not in without
    partial = pdf_text(render_bill_pdf(hist(S.previous([("2026-08-01", "2026-08-31", "812.4")]))))
    assert "צריכה בתקופות קודמות" in partial and "אשתקד" not in partial
    assert "08.26" in partial and "702" not in partial  # last year's value was not given, so it is not shown


@needs_render
def test_golden_big_bill_has_many_pages_repeated_headers_and_page_numbers():
    pdf = render_bill_pdf(S.big(150))
    pages = pdf_pages_text(pdf)
    n = len(pages)
    assert n >= 3 and int(pdf_info(pdf)["Pages"]) == n
    for number, page in enumerate(pages, start=1):
        assert re.search(rf"עמוד\s*{number}\s*מתוך\s*{n}", " ".join(page.split())), number
    meter_pages = [p for p in pages if "מונה דירה" in p]
    assert len(meter_pages) >= 3
    assert all("קריאה בתחילת התקופה" in p for p in meter_pages)  # the table header repeats on every table page
    assert "חשבון צריכת חשמל ודרישת תשלום" in pages[0] and all("חשבון צריכת חשמל ודרישת תשלום" not in p for p in pages[1:])
    joined = " ".join(pages)
    assert "150" in joined and "מונה דירה" in pages[0] and "001" in pages[0]


@needs_render
def test_golden_hostile_strings_print_as_text_and_load_nothing():
    pdf = render_bill_pdf(hostile_snapshot())
    text = flat(pdf)
    assert "<script>alert(1)</script>" in text and "example.invalid/x.png" in text
    assert "{{7*7}}" in text and "${x}" in text  # template syntax is just text
    for marker in (b"/URI", b"/JavaScript", b"/Launch", b"/EmbeddedFile", b"/OpenAction"):
        assert marker not in pdf


@needs_render
def test_golden_empty_and_minimal_states():
    data = S.no_history()
    data["business"] = {"name": "עסק"}
    data["customer"] = {"name": "לקוח"}
    data["bill"].update(issue_date=None, due_date=None, expected_due_date=None)
    data["account"] = {"formula": {}}
    data["totals"]["price_mode_note_he"] = None
    text = pdf_text(render_bill_pdf(data))
    assert "עסק" in text and "לקוח" in text and "497.35" in text
    for absent in ("הערות:", "נוסחת החשבון", "לתשלום עד", "תאריך הפקה", "ח.פ.", "צריכה בתקופות קודמות"):
        assert absent not in text, absent
    zero = S.no_history()
    zero["meters"] = [{"meter_id": "m", "name": "מונה", "coefficient": "1", "start": {"reading_kwh": "10"},
                       "end": {"reading_kwh": "10"}, "consumption_kwh": "0", "contribution_kwh": "0"}]
    zero["lines"] = [{"from": "2026-09-01", "to": "2026-09-30", "kwh": "0", "unit_price_ex_vat": "0.5430",
                      "amount_ex_vat": "0", "vat_rate_percent": "18", "vat_amount": "0"}]
    zero["totals"].update(kwh="0", amount_ex_vat="0", vat_amount="0", total="0")
    assert "0.00" in pdf_text(render_bill_pdf(zero))


@needs_render
def test_golden_vat_split_shows_each_rate_and_a_rounding_line():
    data = S.base()
    data["lines"] = [
        {"from": "2026-09-01", "to": "2026-09-14", "kwh": "400", "unit_price_ex_vat": "0.5430", "vat_rate_percent": "17",
         "amount_ex_vat": "217.20", "vat_amount": "36.92"},
        {"from": "2026-09-15", "to": "2026-09-30", "kwh": "376.20", "unit_price_ex_vat": "0.5430", "vat_rate_percent": "18",
         "amount_ex_vat": "204.28", "vat_amount": "36.77"}]
    data["totals"].update(amount_ex_vat="421.48", vat_amount="73.70", total="495.18")  # lines sum to 73.69: one agora
    text = flat(render_bill_pdf(data))
    assert "מע״מ 17%" in text and "מע״מ 18%" in text and "הפרשי עיגול" in text and "15.09.2026" in text


@needs_render
def test_golden_price_including_vat_note_is_printed():
    data = S.base()
    data["totals"]["price_mode_note_he"] = "המחיר נקבע כולל מע״מ"
    assert "המחיר נקבע כולל מע״מ" in flat(render_bill_pdf(data))


@needs_render
def test_golden_mixed_hebrew_digits_and_latin():
    data = S.base()
    data["customer"].update(name="דנה Cohen & Sons בע״מ 2000", customer_number="C-1042")
    data["account"]["name"] = "קומה 3 / Floor 3 - A/C"
    data["business"].update(name="ACME Power Ltd חברת חשמל 2026", address="Herzl 5 רחוב הרצל 5, Tel Aviv")
    data["meters"][0]["name"] = "Main-board MB-1 לוח ראשי 400A"
    text = pdf_text(render_bill_pdf(data))
    for token in ("Cohen", "Sons", "2000", "ACME Power Ltd", "2026", "Herzl 5", "Tel Aviv", "MB-1", "400A", "C-1042", "Floor 3"):
        assert token in text, token


CYRILLIC_ARABIC_NAMES = dict(customer="Иванов Пётр Сергеевич", meter="Щиток №3 підвал", address="ул. Бабеля 12, Київ",
                             business="شركة النور للكهرباء", account="محمد عبد الله")


def arabic_letters(text: str) -> set[str]:
    """pdftotext may emit Arabic presentation forms (U+FBxx / U+FExx) in visual order; compare the base letters only."""
    import unicodedata

    return {ch for ch in unicodedata.normalize("NFKC", text) if "ؠ" <= ch <= "ي"}


@needs_render
def test_golden_cyrillic_and_arabic_names():
    """2.0.2: names typed in Cyrillic or Arabic render through the bundled Noto subsets (the Heebo subsets have no such glyphs)."""
    data = S.base()
    data["customer"].update(name=CYRILLIC_ARABIC_NAMES["customer"], address=CYRILLIC_ARABIC_NAMES["address"])
    data["account"]["name"] = CYRILLIC_ARABIC_NAMES["account"]
    data["business"]["name"] = CYRILLIC_ARABIC_NAMES["business"]
    data["meters"][0]["name"] = CYRILLIC_ARABIC_NAMES["meter"]
    pdf = render_bill_pdf(data)
    text = pdf_text(pdf)
    for token in ("Иванов", "Пётр", "Сергеевич", "Щиток", "підвал", "Бабеля", "Київ"):
        assert token in text, token
    assert arabic_letters(CYRILLIC_ARABIC_NAMES["business"] + CYRILLIC_ARABIC_NAMES["account"]) <= arabic_letters(text)
    names = {f[0] for f in pdf_fonts(pdf)}
    assert any("NotoSans" in n and "Arabic" not in n for n in names) and any("NotoSansArabic" in n for n in names), names
    assert any("Heebo" in n for n in names)  # the layout itself stays Heebo
    # a bill without such names embeds no Noto at all
    assert not any("Noto" in f[0] for f in pdf_fonts(render_bill_pdf(S.base())))


@pytest.mark.skipif(not HAVE_POPPLER, reason="poppler-utils not installed")
def test_fpdf2_fallback_draws_cyrillic_and_arabic_names():
    pytest.importorskip("fpdf")
    data = S.base()
    data["customer"]["name"] = CYRILLIC_ARABIC_NAMES["customer"]
    data["account"]["name"] = CYRILLIC_ARABIC_NAMES["account"]
    pdf = render_bill_pdf(data, engine="fpdf2")
    text = pdf_text(pdf)
    assert "Иванов" in text and "Сергеевич" in text
    assert arabic_letters(CYRILLIC_ARABIC_NAMES["account"]) <= arabic_letters(text)  # unjoined forms are accepted here


def bbox_words(pdf: bytes) -> list[tuple[float, float, float, float]]:
    return [w[:4] for w in bbox_text_words(pdf)]


def bbox_text_words(pdf: bytes) -> list[tuple[float, float, float, float, str]]:
    html = subprocess.run(["pdftotext", "-bbox", "-", "-"], input=pdf, capture_output=True, check=True).stdout.decode()
    def logical(w: str) -> str:  # pdftotext -bbox reports Hebrew words in visual (reversed) order
        w = BIDI.sub("", w)
        return w[::-1] if re.search("[\u05d0-\u05ea]", w) else w

    return [(float(a), float(b), float(c), float(d), logical(w)) for a, b, c, d, w in re.findall(
        r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)</word>', html)]


@needs_render
def test_golden_long_names_wrap_inside_the_page():
    data = S.base()
    data["customer"].update(name="סטודיו " + "א" * 140, address="רחוב " + "ב" * 120 + " 12")
    data["account"]["name"] = "א" * 140
    data["business"].update(name="נכסי " + "ג" * 130, address="ד" * 150, footer_note="הערה " + "ו" * 600)
    data["meters"][0]["name"] = "מונה " + "ה" * 160
    pdf = render_bill_pdf(data)
    words = bbox_words(pdf)
    assert words and max(w[2] for w in words) <= 595.3 - 20 and min(w[0] for w in words) >= 20  # inside the margins
    assert int(pdf_info(pdf)["Pages"]) <= 3
    data2 = S.base()
    data2["customer"].update(name="דוד בן גוריון " * 12, address="רחוב " + "הדוגמה " * 20)
    assert max(w[2] for w in bbox_words(render_bill_pdf(data2))) <= 595.3 - 20


# ================================================================================================ fallback engine
@pytest.mark.skipif(not HAVE_POPPLER, reason="poppler-utils not installed")
def test_fpdf2_fallback_renders_the_same_facts():
    pytest.importorskip("fpdf")
    pdf = render_bill_pdf(S.missing_report(), engine="fpdf2")
    text = " ".join(pdf_text(pdf).split())
    for token in ("2026-09-0001", "497.35", "421.48", "75.87", "סטודיו אורן לעיצוב", "01.09.2026", "30.09.2026", "לוח סטודיו",
                  "29.09.2026", "07:10", "צריכה בתקופות קודמות", "845"):
        assert token in text, token
    assert re.match(r"\s*595\.\d+ x 841\.\d+", pdf_info(pdf)["Page size"])
    assert all("Heebo" in f[0] for f in pdf_fonts(pdf))
    assert int(pdf_info(render_bill_pdf(S.big(150), engine="fpdf2"))["Pages"]) >= 3
    assert "טיוטה" in pdf_text(render_bill_pdf(S.draft(), engine="fpdf2"))
    assert "אשתקד" not in pdf_text(render_bill_pdf(S.no_history(), engine="fpdf2"))


def test_auto_engine_falls_back_to_fpdf2_when_weasyprint_cannot_load(monkeypatch):
    pytest.importorskip("fpdf")

    def broken(*_a, **_k):
        raise OSError("cannot load library 'libpango-1.0-0'")

    monkeypatch.setattr(bill_pdf_engine, "render_weasyprint", broken)
    pdf, engine = bill_pdf_engine.run_job({"snapshot": S.base(), "engine": "auto"})
    assert engine == "fpdf2" and pdf.startswith(b"%PDF-")
    with pytest.raises(OSError):
        bill_pdf_engine.run_job({"snapshot": S.base(), "engine": "weasyprint"})
    monkeypatch.setattr(bill_pdf_engine, "render_weasyprint",
                        lambda *a, **k: (_ for _ in ()).throw(bill_pdf_engine.RenderRefused("pdf_page_limit")))
    with pytest.raises(bill_pdf_engine.RenderRefused):  # a hard limit never falls back
        bill_pdf_engine.run_job({"snapshot": S.base(), "engine": "auto"})


# ================================================================================================ limits
@needs_render
def test_timeout_kills_the_render_and_leaves_no_child(monkeypatch):
    started: list[subprocess.Popen] = []
    real = subprocess.Popen

    def spy(*a, **k):
        proc = real(*a, **k)
        started.append(proc)
        return proc

    monkeypatch.setattr(bill_pdf.subprocess, "Popen", spy)
    t0 = time.perf_counter()
    with pytest.raises(BillPdfError) as err:
        render_bill_pdf(S.big(150), timeout_s=0.05)
    assert err.value.code == "pdf_timeout" and err.value.retryable
    assert time.perf_counter() - t0 < 10
    assert started and started[0].poll() is not None  # reaped


@needs_render
def test_page_cap_is_enforced(monkeypatch):
    monkeypatch.setenv("SW_BILL_PDF_MAX_PAGES", "2")
    with pytest.raises(BillPdfError) as err:
        render_bill_pdf(S.big(150))
    assert err.value.code == "pdf_page_limit" and not err.value.retryable
    monkeypatch.setenv("SW_BILL_PDF_MAX_PAGES", "40")
    assert render_bill_pdf(S.big(150)).startswith(b"%PDF-")


def test_limits_come_from_the_environment_and_are_clamped(monkeypatch):
    monkeypatch.setenv("SW_BILL_PDF_TIMEOUT_S", "9999")
    monkeypatch.setenv("SW_BILL_PDF_MEMORY_MB", "1")
    monkeypatch.setenv("SW_BILL_PDF_MAX_PAGES", "banana")
    monkeypatch.setenv("SW_BILL_PDF_ENGINE", "rm -rf")
    lim = bill_pdf._limits(None, None)
    assert lim.timeout_s == 120 and lim.memory_bytes == 256 * 1024 * 1024 and lim.max_pages == 40 and lim.engine == "auto"


def test_child_environment_is_scrubbed(monkeypatch):
    monkeypatch.setenv("SW_SECRET_TOKEN", "nope")
    monkeypatch.setenv("HTTPS_PROXY", "http://proxy.invalid")
    env = bill_pdf._child_env()
    assert "SW_SECRET_TOKEN" not in env and "HTTPS_PROXY" not in env and "PYTHONPATH" in env


@pytest.mark.skipif(sys.platform == "win32", reason="address-space limit applies to POSIX")
def test_memory_limit_is_applied_to_the_child_process(monkeypatch, tmp_path):
    monkeypatch.setenv("SW_BILL_PDF_MEMORY_MB", "256")  # the lowest the clamp allows
    limits = bill_pdf._limits(None, None)
    prefix = ("from smplwise.services.bill_pdf_engine import apply_limits; "
              f"apply_limits({limits.memory_bytes}, 30, 12000000); ")
    run = lambda body: subprocess.run([sys.executable, "-c", prefix + body], capture_output=True,  # noqa: E731
                                      cwd=bill_pdf._PACKAGE_PARENT)
    proc = run("x = bytearray(700 * 1024 * 1024); print('allocated')")
    assert proc.returncode != 0 and b"allocated" not in proc.stdout and b"MemoryError" in proc.stderr
    ok = run("x = bytearray(20 * 1024 * 1024); print('allocated')")
    assert ok.returncode == 0 and b"allocated" in ok.stdout
    big_file = run(f"open({str(tmp_path / 'probe')!r}, 'wb').write(b'x' * 13_000_000)")
    assert big_file.returncode != 0  # RLIMIT_FSIZE: SIGXFSZ / OSError before a 13 MB file is written


@needs_render
def test_bad_logo_is_dropped_and_the_bill_still_renders():
    assert "497.35" in pdf_text(render_bill_pdf(S.base(), logo=b'<svg xmlns="http://www.w3.org/2000/svg"/>'))


@needs_render
def test_malformed_snapshot_is_a_caller_error_not_a_render_failure():
    with pytest.raises(BillSnapshotError):
        render_bill_pdf(mutate("bill.state", "weird"))


@needs_render
def test_render_time_budget_for_a_three_page_bill_on_this_machine():
    """Measurement, not the target-hardware gate: the 5 s budget is for the owner's ARM board. Here the bound is loose
    (x SW_TEST_TIME_FACTOR); the real numbers are in docs/evidence/electricity-pdf/."""
    from conftest import sw_time_factor

    render_bill_pdf(S.base())  # warm the font cache
    t0 = time.perf_counter()
    pdf = render_bill_pdf(S.big(150))
    elapsed = time.perf_counter() - t0
    assert int(pdf_info(pdf)["Pages"]) >= 3
    assert elapsed < 15 * sw_time_factor(), f"3+ page bill took {elapsed:.1f} s"


def test_previous_period_consumption_is_not_stated_from_partial_or_distant_data():
    assert snap(S.base()).previous_kwh == Decimal("776.20")
    partial = S.with_history(S.previous([("2026-08-01", "2026-08-31", "500")], status="partial"), None)
    assert snap(partial).previous_kwh is None
    gap = S.with_history(S.previous([("2026-07-01", "2026-07-31", "500")]), None)  # August is missing
    assert snap(gap).previous_kwh is None


def test_period_dates_are_dates():
    assert snap(S.base()).period_start == date(2026, 9, 1)
