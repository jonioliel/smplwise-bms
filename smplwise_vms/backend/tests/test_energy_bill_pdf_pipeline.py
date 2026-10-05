"""EL8: the electricity bill PDF through the whole add-on path, with the REAL renderer.

Readings store -> billing engine -> snapshot -> `GET /energy/bills/{id}/pdf` -> `bill_pdf` child process -> WeasyPrint -> PDF
bytes, then the PDF itself is read back with poppler (page size, embedded fonts, Hebrew text in logical order, digits not
reversed). Only the clock is pinned; no fake renderer, no fake readings provider.

On a machine without the WeasyPrint stack or poppler (the Windows workstation) the render tests skip with the reason.
`SW_REQUIRE_BILL_PDF=1` (set by scripts/addon_image/check_bill_pdf.sh inside the add-on image) turns that into a failure:
in the image a missing library must be red, never a skip, and the active engine must be WeasyPrint, not the fallback.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import io
import os
import re
import shutil
import subprocess
import uuid

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from smplwise.db import Database
from smplwise.main import create_app
from smplwise.services import bill_pdf
from smplwise.services import energy_billing as eb
from smplwise.services import energy_billing_pdf as pdfseam
from smplwise.services import energy_store as st
from smplwise.services.energy_billing_provider import set_provider
from test_energy_store import add_meter, feed, local

API = "/api/v1/energy"
UTC = dt.timezone.utc
REQUIRED = os.environ.get("SW_REQUIRE_BILL_PDF") == "1"
BIDI = re.compile("[‎‏‪-‮⁦-⁩]")

try:
    from weasyprint import HTML

    HTML(string="<p>x</p>").render()  # the import alone succeeds on some systems where Pango cannot be loaded
    HAVE_WEASY, WHY = True, ""
except Exception as exc:  # noqa: BLE001 - missing package or missing native libraries
    HAVE_WEASY, WHY = False, f"WeasyPrint cannot render here: {type(exc).__name__}: {str(exc)[:120]}"
HAVE_POPPLER = all(shutil.which(t) for t in ("pdftotext", "pdfinfo", "pdffonts"))
if not HAVE_POPPLER:
    WHY = WHY or "poppler-utils (pdftotext/pdfinfo/pdffonts) not installed"
needs_render = pytest.mark.skipif(not (HAVE_WEASY and HAVE_POPPLER) and not REQUIRED, reason=WHY)


def text_of(pdf: bytes) -> str:
    return BIDI.sub("", subprocess.run(["pdftotext", "-", "-"], input=pdf, capture_output=True, check=True).stdout.decode())


def flat(pdf: bytes) -> str:
    return " ".join(text_of(pdf).split())


def info_of(pdf: bytes) -> dict[str, str]:
    out = subprocess.run(["pdfinfo", "-"], input=pdf, capture_output=True, check=True).stdout.decode()
    return {k.strip(): v.strip() for k, v in (line.split(":", 1) for line in out.splitlines() if ":" in line)}


def fonts_of(pdf: bytes) -> list[list[str]]:
    out = subprocess.run(["pdffonts", "-"], input=pdf, capture_output=True, check=True).stdout.decode()
    return [line.split() for line in out.splitlines()[2:] if line.strip()]


def rid() -> str:
    return uuid.uuid4().hex


def logo_png() -> bytes:
    img = Image.new("RGB", (400, 120), (21, 101, 192))
    for x in range(40, 120):
        for y in range(30, 90):
            img.putpixel((x, y), (255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return buf.getvalue()


@pytest.fixture()
def world(settings, monkeypatch):
    set_provider(None)  # the real readings store, through the billing adapter
    pdfseam.set_renderer(None)  # the real renderer (services/bill_pdf)
    monkeypatch.setattr(eb, "now_utc", lambda: dt.datetime(2026, 10, 2, 9, 0, tzinfo=UTC))
    monkeypatch.setattr(eb, "AUTO_EVERY_S", 10**9)
    c = TestClient(create_app(settings))
    assert c.get("/api/v1/me").status_code == 200  # bootstrap: system_admin
    db = Database(settings.db_path)
    store = st.store_for(settings)
    main = add_meter(db, "לוח ראשי")
    feed(store, main, [(local(2025, 9, 1), 400_000), (local(2025, 10, 1), 1_102_100),   # same period last year: 702.10 kWh
                       (local(2026, 7, 1), 0), (local(2026, 8, 1), 640_300), (local(2026, 9, 1), 1_000_000),
                       (local(2026, 9, 16), 1_388_100), (local(2026, 10, 1), 1_776_200), (local(2026, 10, 2), 1_800_000)])
    s = c.put(f"{API}/billing-settings", json={"business": {
        "name": "ניהול מבנים אורן בע״מ", "registration_no": "515000000", "address": "רחוב הנביאים 12, ירושלים",
        "phone": "02-0000000", "email": "billing@example.invalid", "footer_note": "התשלום בהעברה בנקאית בלבד."}})
    assert s.status_code == 200, s.text
    up = c.put(f"{API}/billing-settings/logo", content=logo_png(), headers={"Content-Type": "image/png"})
    assert up.status_code == 200, up.text
    t = c.post(f"{API}/tariffs", json={"name": "תעריף ביתי", "price": "0.5430", "price_mode": "ex_vat", "effective_from": "2025-01-01"})
    assert t.status_code == 201, t.text
    assert c.post(f"{API}/vat-rates", json={"effective_from": "2025-01-01", "rate_percent": "18"}).status_code == 201
    cust = c.post(f"{API}/customers", json={"name": "סטודיו אורן לעיצוב", "address": "רחוב יפו 1, ירושלים"})
    assert cust.status_code == 201, cust.text
    acc = c.post(f"{API}/accounts", json={"name": "דירה 4", "customer_id": cust.json()["id"], "formula": {"text": "[לוח ראשי]"},
                                          "tariff_id": t.json()["id"], "period_months": 1, "period_anchor_day": 1,
                                          "first_period_start": "2026-07-01", "auto_mode": "off"})
    assert acc.status_code == 201, acc.text
    yield c, settings, acc.json()
    pdfseam.set_renderer(None)


def _issue_month(c, aid: str, frm: str, to: str) -> dict:
    d = c.post(f"{API}/accounts/{aid}/bills", json={"client_request_id": rid(), "period": {"from": frm, "to": to}})
    assert d.status_code == 201, d.text
    i = c.post(f"{API}/bills/{d.json()['id']}/issue", json={"row_version": d.json()["row_version"], "client_request_id": rid()})
    assert i.status_code == 200, i.text
    return i.json()


def test_render_stack_is_present_where_it_is_required():
    """In the add-on image (SW_REQUIRE_BILL_PDF=1) the full WeasyPrint stack must work and be the active engine."""
    if not REQUIRED:
        pytest.skip("SW_REQUIRE_BILL_PDF is not set (only the add-on image check sets it)")
    assert HAVE_WEASY, WHY
    assert HAVE_POPPLER, "poppler-utils missing"
    s = bill_pdf.self_check(timeout_s=90)
    assert s["checked"] and s["active"] == "weasyprint", s


@needs_render
def test_bill_pdf_end_to_end_with_the_real_renderer(world):
    c, settings, acc = world
    aid = acc["id"]
    _issue_month(c, aid, "2026-07-01", "2026-07-31")
    _issue_month(c, aid, "2026-08-01", "2026-08-31")
    d = c.post(f"{API}/accounts/{aid}/bills", json={"client_request_id": rid(), "period": {"from": "2026-09-01", "to": "2026-09-30"}})
    assert d.status_code == 201, d.text
    draft = d.json()
    assert draft["snapshot"]["totals"]["kwh"] == "776.20" and draft["snapshot"]["totals"]["total"] == "497.35"

    # the draft: rendered on every request, watermarked, never stored
    r = c.get(f"{API}/bills/{draft['id']}/pdf")
    assert r.status_code == 200, r.text
    assert r.headers["content-type"] == "application/pdf" and r.content.startswith(b"%PDF-")
    assert "טיוטה" in flat(r.content)
    engine = bill_pdf.engine_status()
    if REQUIRED:
        assert engine["last_render_engine"] == "weasyprint", engine

    # issue, then the stored PDF of the issued bill
    i = c.post(f"{API}/bills/{draft['id']}/issue", json={"row_version": draft["row_version"], "client_request_id": rid()})
    assert i.status_code == 200, i.text
    bill = i.json()
    assert bill["number"] == "2026-09-0003"
    r1 = c.get(f"{API}/bills/{bill['id']}/pdf")
    assert r1.status_code == 200, r1.text
    pdf = r1.content
    assert 'filename="2026-09-0003.pdf"' in r1.headers["content-disposition"]
    info = info_of(pdf)
    assert info["Pages"] == "1" and re.match(r"595\.\d+ x 841\.\d+ pts \(A4\)", info["Page size"]), info
    fonts = fonts_of(pdf)
    assert fonts and all("Heebo" in f[0] for f in fonts), fonts  # nothing from the system font set
    assert all(f[-5] == "yes" for f in fonts), fonts  # emb column
    for active in (b"/JavaScript", b"/Launch", b"/URI", b"/EmbeddedFile", b"/OpenAction"):
        assert active not in pdf

    text = text_of(pdf)
    for token in ("חשבון צריכת חשמל ודרישת תשלום", "אינו חשבונית מס", "2026-09-0003", "ניהול מבנים אורן בע״מ", "515000000",
                  "סטודיו אורן לעיצוב", "רחוב יפו 1, ירושלים", "דירה 4", "תקופת החיוב", "01.09.2026", "30.09.2026",
                  "תעריף ביתי", "סה״כ לתשלום", "497.35", "776.20", "421.48", "75.87", "0.5430", "לוח ראשי",
                  "מע״מ 18%", "02.10.2026", "התשלום בהעברה בנקאית בלבד", "SmplWise Arx", "₪"):
        assert token in text, token
    for reversed_token in ("3000-90-6202", "53.794", "02.677", "6202.90.10"):
        assert reversed_token not in text, reversed_token
    assert re.search(r"עמוד\s*1\s*מתוך\s*1", text)
    # the history chart: July and August of this year and September last year (labels MM.YY), values printed
    for label in ("07.26", "08.26", "09.25", "640", "702"):
        assert label in text, label
    # the PDF footer prints the first 12 hex of the snapshot hash the server stored
    assert bill["snapshot_sha256"][:12] in text

    # stored once on disk, byte-identical on the next request, a copy is rendered again with its watermark
    db = Database(settings.db_path)
    with db.connection(mode="read") as conn:
        row = conn.execute("SELECT pdf_path, pdf_sha256 FROM energy_bills WHERE id = ?", (bill["id"],)).fetchone()
    assert row["pdf_sha256"] == hashlib.sha256(pdf).hexdigest()
    assert (settings.data_dir / row["pdf_path"]).read_bytes() == pdf
    assert c.get(f"{API}/bills/{bill['id']}/pdf").content == pdf
    copy = c.get(f"{API}/bills/{bill['id']}/pdf?copy=1")
    assert copy.status_code == 200 and "העתק" in flat(copy.content) and copy.content != pdf
    assert c.get(f"{API}/bills/{bill['id']}").json()["pdf"]["state"] == "stored"


@needs_render
def test_billing_settings_report_the_engine_the_self_check_found(world):
    c, _settings, _acc = world
    bill_pdf.self_check(timeout_s=90)
    eng = c.get(f"{API}/billing-settings").json()["pdf_engine"]
    assert eng["checked"] is True and eng["active"] in ("weasyprint", "fpdf2"), eng
    if REQUIRED:
        assert eng["active"] == "weasyprint", eng
