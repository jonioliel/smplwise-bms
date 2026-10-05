"""A draft bill whose snapshot cannot be printed answers a specific error, not a blind "try again" (pilot/bill-pdf-diagnostics).

Live failure: the owner's draft answered 503 pdf_render_failed. Root cause: a meter with no reading at the period edge gives
`reading_kwh: null` in the snapshot, the PDF model refused it ("meters.start.reading_kwh: a number is required") and the API
mapped every BillSnapshotError to a non-retryable pdf_render_failed with the message dropped.
"""
from __future__ import annotations

import datetime as dt
import json
import logging
import uuid

import pytest
from fastapi.testclient import TestClient

from smplwise.db import Database
from smplwise.main import create_app
from smplwise.services import energy_billing as eb
from smplwise.services import energy_billing_pdf as pdfseam
from smplwise.services.bill_pdf_html import reading
from smplwise.services.bill_pdf_model import BillSnapshot, BillSnapshotError
from smplwise.services.energy_billing_provider import set_provider
from test_energy_store import add_meter

API = "/api/v1/energy"
UTC = dt.timezone.utc


@pytest.fixture()
def world(settings, monkeypatch):
    set_provider(None)
    pdfseam.set_renderer(None)  # the real renderer: validation runs in-process before any engine starts
    monkeypatch.setattr(eb, "now_utc", lambda: dt.datetime(2026, 10, 2, 9, 0, tzinfo=UTC))
    monkeypatch.setattr(eb, "AUTO_EVERY_S", 10**9)
    c = TestClient(create_app(settings))
    assert c.get("/api/v1/me").status_code == 200
    db = Database(settings.db_path)
    add_meter(db, "מונה ללא דיווח")  # never reported: no readings at all
    assert c.put(f"{API}/billing-settings", json={"business": {"name": "עסק", "registration_no": "515000000"}}).status_code == 200
    t = c.post(f"{API}/tariffs", json={"name": "תעריף", "price": "0.5430", "price_mode": "ex_vat", "effective_from": "2025-01-01"})
    assert c.post(f"{API}/vat-rates", json={"effective_from": "2025-01-01", "rate_percent": "18"}).status_code == 201
    cust = c.post(f"{API}/customers", json={"name": "לקוח", "address": "רחוב 1"})
    acc = c.post(f"{API}/accounts", json={"name": "דירה", "customer_id": cust.json()["id"], "formula": {"text": "[מונה ללא דיווח]"},
                                          "tariff_id": t.json()["id"], "period_months": 1, "period_anchor_day": 1,
                                          "first_period_start": "2026-09-01", "auto_mode": "off"})
    assert acc.status_code == 201, acc.text
    yield c, acc.json(), db
    pdfseam.set_renderer(None)


def _draft(c, acc):
    d = c.post(f"{API}/accounts/{acc['id']}/bills", json={"client_request_id": uuid.uuid4().hex, "period": {"from": "2026-09-01", "to": "2026-09-30"}})
    assert d.status_code == 201, d.text
    return d.json()


def _edit_stored(db, bid, mutate):
    with db.connection() as conn:
        snap = json.loads(conn.execute("SELECT snapshot_json FROM energy_bills WHERE id = ?", (bid,)).fetchone()["snapshot_json"])
        mutate(snap)
        conn.execute("UPDATE energy_bills SET snapshot_json = ? WHERE id = ?", (json.dumps(snap, ensure_ascii=False), bid))


def test_a_meter_without_readings_gives_null_readings_and_the_model_accepts_them(world):
    c, acc, _ = world
    snap = _draft(c, acc)["snapshot"]
    assert snap["meters"][0]["start"]["reading_kwh"] is None and snap["meters"][0]["end"]["reading_kwh"] is None
    assert snap["lines"], "a fixed tariff keeps one line even without consumption"
    model = BillSnapshot.from_billing_snapshot(snap)  # used to raise "meters.start.reading_kwh: a number is required"
    assert model.meters[0].start_reading is None and model.meters[0].end_reading is None
    assert reading(None) == "-"


def test_the_pdf_route_passes_that_draft_to_the_renderer(world):
    c, acc, _ = world
    seen = {}

    def fake(snapshot, **kw):
        seen["wm"] = kw.get("watermark")
        BillSnapshot.from_billing_snapshot(snapshot, watermark=kw.get("watermark"))  # the real validation, as render_bill_pdf does
        return b"%PDF-1.7 fake"

    pdfseam.set_renderer(fake)
    r = c.get(f"{API}/bills/{_draft(c, acc)['id']}/pdf")
    assert r.status_code == 200 and seen["wm"] == "draft"


def test_a_draft_with_no_lines_prints_with_a_note_but_an_issued_bill_without_lines_is_refused(world):
    c, acc, _ = world
    snap = _draft(c, acc)["snapshot"]
    snap["lines"] = []
    model = BillSnapshot.from_billing_snapshot(snap)
    assert model.charges == () and any("טיוטה ללא צריכה" in n for n in model.notes)
    snap["bill"].update(state="issued", number="2026-09-0001")
    with pytest.raises(BillSnapshotError) as ei:
        BillSnapshot.from_billing_snapshot(snap)
    assert ei.value.code == "no_lines" and ei.value.field == "lines"


def test_an_issued_bill_without_lines_answers_pdf_no_lines_with_no_retry(world, caplog):
    c, acc, db = world
    d = _draft(c, acc)
    i = c.post(f"{API}/bills/{d['id']}/issue", json={"row_version": d["row_version"], "client_request_id": uuid.uuid4().hex})
    assert i.status_code == 200, i.text
    _edit_stored(db, d["id"], lambda s: s.update(lines=[]))
    with caplog.at_level(logging.WARNING, logger="smplwise.energy_billing"):
        r = c.get(f"{API}/bills/{d['id']}/pdf")
    assert r.status_code == 422, r.text
    body = r.json()
    assert body["code"] == "pdf_no_lines" and body["retryable"] is False and "אין שורות חיוב" in body["user_message"]
    assert "pdf_no_lines" in caplog.text and "field=lines" in caplog.text
    assert c.get(f"{API}/bills/{d['id']}").json()["pdf"]["error_code"] == "pdf_no_lines"


def test_any_other_invalid_field_answers_pdf_invalid_snapshot_with_the_field_name(world, caplog):
    c, acc, db = world
    bid = _draft(c, acc)["id"]
    _edit_stored(db, bid, lambda s: s["customer"].update(name=""))
    with caplog.at_level(logging.WARNING, logger="smplwise.energy_billing"):
        r = c.get(f"{API}/bills/{bid}/pdf")
    assert r.status_code == 422, r.text
    body = r.json()
    assert body["code"] == "pdf_invalid_snapshot" and body["retryable"] is False
    assert body["details"] == {"field": "customer.name"} and "customer.name" in body["user_message"]
    assert "אפשר לנסות שוב" not in body["user_message"]
    assert "field=customer.name" in caplog.text


def test_the_log_and_the_answer_name_the_field_but_never_the_value(world, caplog):
    c, acc, db = world
    bid = _draft(c, acc)["id"]
    secret = "Sekret-Value-123"
    _edit_stored(db, bid, lambda s: s["totals"].update(total=secret))
    with caplog.at_level(logging.WARNING, logger="smplwise.energy_billing"):
        r = c.get(f"{API}/bills/{bid}/pdf")
    assert r.json()["code"] == "pdf_invalid_snapshot" and r.json()["details"]["field"] == "totals.total"
    assert secret not in caplog.text and secret not in r.text


def test_engine_failures_stay_retryable(world):
    c, acc, _ = world

    def boom(snapshot, **kw):
        raise RuntimeError("engine died")

    pdfseam.set_renderer(boom)
    r = c.get(f"{API}/bills/{_draft(c, acc)['id']}/pdf")
    assert r.status_code == 503 and r.json()["code"] == "pdf_render_failed"


def test_the_real_renderer_prints_the_draft_of_a_meter_without_readings(world):
    """Needs a PDF engine (WeasyPrint or fpdf2): skipped on a machine without one; the runner and the add-on image have it."""
    from smplwise.services import bill_pdf

    c, acc, _ = world
    d = _draft(c, acc)
    try:
        pdf = bill_pdf.render_bill_pdf(d["snapshot"], watermark="draft", timeout_s=60)
    except bill_pdf.BillPdfError as exc:
        pytest.skip(f"no working PDF engine here: {exc.code}")
    assert pdf.startswith(b"%PDF-")
    r = c.get(f"{API}/bills/{d['id']}/pdf")
    assert r.status_code == 200 and r.content.startswith(b"%PDF-")
    snap = d["snapshot"]
    snap["lines"] = []  # the empty draft prints too, with its note
    assert bill_pdf.render_bill_pdf(snap, watermark="draft", timeout_s=60).startswith(b"%PDF-")
