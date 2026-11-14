"""CR-INSIGHT215 part 3: the monthly building report (model, sections omitted with a reason, PDF through the isolated child).

Negative first: switch off = uniform 404, no reports.building = 403, a bad month / unknown section = 422. Then the model
(every requested section is either shown or listed as omitted with a reason), the switch-gated sections, the HTML / plain-line
fallback and a REAL PDF render through the child process, parsed back with pymupdf. Fakes only: no Home Assistant, device or network."""
from __future__ import annotations

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient
from insight215_fixtures import API, NOW, audit_rows, switch

from smplwise.db import Database
from smplwise.services import building_report as rep
from smplwise.services import building_report_pdf as bpdf
from smplwise.services import insights_common as ic

REASONS = {"not_permitted", "module_off", "switch_off"}


@pytest.fixture()
def w(settings, monkeypatch):
    from smplwise.main import create_app
    from smplwise.routers import insights as ir

    monkeypatch.setattr(ir, "now_ts", lambda: NOW)
    c = TestClient(create_app(settings))
    c.get(f"{API}/me")
    yield {"c": c, "db": Database(settings.db_path), "settings": settings}
    bpdf.set_renderer(None)


def test_switched_off_is_the_uniform_404(w):
    for hdr in ({}, as_user("nobody")):
        assert w["c"].get(f"{API}/reports/building/preview", headers=hdr).status_code == 404
        assert w["c"].get(f"{API}/reports/building.pdf", headers=hdr).status_code == 404


def test_no_permission_is_403(w):
    c, s = w["c"], w["settings"]
    switch(w["db"], ic.SW_REPORT)
    bind(c, s, "otto", "operator", "installation", "*")
    assert c.get(f"{API}/reports/building/preview", headers=as_user("otto")).status_code == 403
    assert c.get(f"{API}/reports/building.pdf", headers=as_user("otto")).status_code == 403


@pytest.mark.parametrize("qs", ["month=2026-13", "month=garbage", "sections=nope", "sections=,"])
def test_bad_input_is_422(w, qs):
    switch(w["db"], ic.SW_REPORT)
    r = w["c"].get(f"{API}/reports/building/preview?{qs}")
    assert r.status_code == 422, r.text


def test_every_requested_section_is_shown_or_omitted_with_a_reason(w):
    switch(w["db"], ic.SW_REPORT)
    body = w["c"].get(f"{API}/reports/building/preview?month=2026-09&sections=" + ",".join(ic.SECTIONS)).json()
    assert body["month"] == "2026-09" and body["filename"].endswith(".pdf")
    omitted = {o["section"]: o["reason"] for o in body["omitted"]}
    assert set(omitted.values()) <= REASONS
    assert set(body["sections"]) | set(omitted) == set(ic.SECTIONS)
    assert not set(body["sections"]) & set(omitted)
    # the door and waste insights are switched off: omitted for that reason, never leaking data
    assert omitted["doors"] == "switch_off" and omitted["waste"] == "switch_off"
    assert "doors" not in body["data"] and "waste" not in body["data"]
    assert len(body["digest"]) >= 16


def test_a_switched_on_insight_section_appears(w):
    switch(w["db"], ic.SW_REPORT)
    switch(w["db"], ic.SW_DOORS)
    body = w["c"].get(f"{API}/reports/building/preview?month=2026-09&sections=doors").json()
    assert body["sections"] == ["doors"] and "doors" in body["data"] and not body["omitted"]


def test_the_default_month_is_the_previous_one_and_the_model_is_stable(w):
    switch(w["db"], ic.SW_REPORT)
    a = w["c"].get(f"{API}/reports/building/preview").json()
    b = w["c"].get(f"{API}/reports/building/preview").json()
    assert a["month"] == b["month"] == "2026-09"
    assert a["digest"] == b["digest"]


def test_html_and_plain_lines_in_both_languages(w):
    switch(w["db"], ic.SW_REPORT)
    for lang in ("he", "en"):
        m = w["c"].get(f"{API}/reports/building/preview?month=2026-09&lang={lang}").json()
        html = rep.html_of(m)
        assert ('dir="rtl"' in html) == (lang == "he")
        assert 'src="bill-brand:smplwise-word.png"' in html and '>SmplWise</div>' not in html  # NOTICEPUSH-295: the approved logo, not a text
        assert rep.plain_lines(m)


def test_the_pdf_is_audited_and_uses_the_injected_renderer(w):
    switch(w["db"], ic.SW_REPORT)
    bpdf.set_renderer(lambda model: b"%PDF-1.4 fake")
    r = w["c"].get(f"{API}/reports/building.pdf?month=2026-09")
    assert r.status_code == 200 and r.content.startswith(b"%PDF")
    assert r.headers["cache-control"] == "private, no-store" and r.headers["x-report-digest"]
    assert len(audit_rows(w["db"], "reports.building.pdf")) == 1


def test_a_renderer_failure_is_503_not_a_traceback(w):
    switch(w["db"], ic.SW_REPORT)

    def boom(model):
        raise bpdf.PdfError("pdf_engine_failed")

    bpdf.set_renderer(boom)
    r = w["c"].get(f"{API}/reports/building.pdf?month=2026-09")
    assert r.status_code == 503 and "Traceback" not in r.text


@pytest.mark.parametrize("engine", [None, "fpdf2"])
def test_a_real_pdf_renders_through_the_child_with_hebrew(w, engine):
    fitz = pytest.importorskip("fitz")
    switch(w["db"], ic.SW_REPORT)
    model = w["c"].get(f"{API}/reports/building/preview?month=2026-09&lang=he").json()
    pdf = bpdf.render(model, engine)
    assert pdf.startswith(b"%PDF")
    doc = fitz.open(stream=pdf, filetype="pdf")
    assert doc.page_count >= 1
    text = "".join(p.get_text() for p in doc)
    assert "2026" in text
    assert any("א" <= ch <= "ת" for ch in text), "Hebrew text must survive the render"
