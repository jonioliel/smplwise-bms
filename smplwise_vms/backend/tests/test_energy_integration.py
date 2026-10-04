"""CR-023 integration: the pieces of the five electricity branches working together - billing reads the REAL readings store
through the one seam (energy_billing_adapter), consumption per billing period also for periods without a bill (account
history and the same period last year), the bill PDF wired to the renderer with its error codes and a visible PDF state,
the 5-second fallback to the simple engine and the engine self-check, the logo upload through the renderer's own rules, one
settings registry, one backup table list. Fakes only for the clock and (where stated) the PDF renderer; no device."""
from __future__ import annotations

import datetime as dt
import io
import uuid

import pytest
from fastapi.testclient import TestClient

from smplwise.db import Database
from smplwise.main import create_app
from smplwise.services import backup, bill_pdf, energy_backup, energy_billing as eb, energy_billing_adapter as adapter
from smplwise.services import energy_billing_pdf as pdfseam
from smplwise.services import energy_provider as ep
from smplwise.services import energy_settings as es
from smplwise.services import energy_store as st
from smplwise.services.energy_billing_provider import NullReadings, get_provider, set_provider
from test_energy_store import add_meter, feed, local

API = "/api/v1/energy"
UTC = dt.timezone.utc


def rid() -> str:
    return uuid.uuid4().hex


@pytest.fixture()
def world(settings, monkeypatch):
    set_provider(None)  # the REAL readings store, through the adapter
    pdfseam.set_renderer(None)
    monkeypatch.setattr(eb, "now_utc", lambda: dt.datetime(2026, 10, 2, 9, 0, tzinfo=UTC))
    monkeypatch.setattr(eb, "AUTO_EVERY_S", 10**9)  # no automatic drafts in these tests
    c = TestClient(create_app(settings))
    assert c.get("/api/v1/me").status_code == 200  # bootstrap: system_admin
    db = Database(settings.db_path)
    store = st.store_for(settings)
    mid = add_meter(db, "לוח ראשי")
    feed(store, mid, [(local(2025, 9, 1), 400_000), (local(2025, 10, 1), 900_000),   # last year: 500 kWh in September 2025
                      (local(2026, 9, 1), 1_000_000), (local(2026, 9, 16), 1_388_100), (local(2026, 10, 1), 1_776_200),
                      (local(2026, 10, 2), 1_800_000)])
    t = c.post(f"{API}/tariffs", json={"name": "כללי", "price": "0.5000", "price_mode": "ex_vat", "effective_from": "2025-01-01"})
    assert t.status_code == 201, t.text
    assert c.post(f"{API}/vat-rates", json={"effective_from": "2025-01-01", "rate_percent": "18"}).status_code == 201
    cust = c.post(f"{API}/customers", json={"name": "לקוח בדיקה"})
    assert cust.status_code == 201, cust.text
    acc = c.post(f"{API}/accounts", json={"name": "חשבון", "customer_id": cust.json()["id"], "formula": {"text": "[לוח ראשי]"}, "tariff_id": t.json()["id"],
                                          "period_months": 1, "period_anchor_day": 1, "first_period_start": "2026-09-01", "auto_mode": "off"})
    assert acc.status_code == 201, acc.text
    yield c, settings, db, store, mid, acc.json()
    pdfseam.set_renderer(None)


def _draft(c, aid, frm="2026-09-01", to="2026-09-30"):
    r = c.post(f"{API}/accounts/{aid}/bills", json={"period": {"from": frm, "to": to}, "client_request_id": rid()})
    assert r.status_code == 201, r.text
    return r.json()


def test_billing_reads_the_real_store_through_the_adapter(world, settings):
    c, settings, db, store, mid, acc = world
    with db.connection(mode="read") as conn:
        p = get_provider(conn, settings)
        assert isinstance(p, ep.EnergyProvider), "billing gets the store's EnergyReadingsProvider via energy_billing_adapter"
        expected = p.consumption(mid, local(2026, 9, 1), local(2026, 10, 1)).wh
        assert adapter.provider(None, settings) is None and isinstance(get_provider(None, None), (NullReadings, ep.EnergyProvider))
    assert expected == 776_200
    b = _draft(c, acc["id"])
    assert b["kwh"] == "776.20" and b["snapshot"]["meters"][0]["meter_id"] == mid
    assert b["snapshot"]["meters"][0]["reported_to_end"] is True
    hist = b["snapshot"]["history"]
    assert hist["same_period_last_year"]["kwh"] == "500.00" and hist["same_period_last_year"]["source"] == "readings"


def test_account_history_covers_periods_without_a_bill(world):
    c, settings, db, store, mid, acc = world
    h = c.get(f"{API}/accounts/{acc['id']}/history", params={"past": 12})
    assert h.status_code == 200, h.text
    rows = h.json()["periods"]
    assert rows[-1]["from"] == "2026-09-01" and rows[-1]["to"] == "2026-09-30"
    assert rows[-1]["kwh"] == "776.20" and rows[-1]["source"] == "readings" and rows[-1]["bill"] is None  # no bill yet
    assert rows[0]["from"] <= "2025-10-01" and all(r["source"] in ("readings", None) for r in rows)
    comp = h.json()["comparison"]
    assert comp["current"]["kwh"] == "776.20" and comp["same_period_last_year"]["kwh"] == "500.00"
    # issue the September bill: the row now comes from the bill
    b = _draft(c, acc["id"])
    r = c.post(f"{API}/bills/{b['id']}/issue", json={"row_version": b["row_version"], "client_request_id": rid()})
    assert r.status_code == 200, r.text
    rows = c.get(f"{API}/accounts/{acc['id']}/history").json()["periods"]
    assert rows[-1]["source"] == "bill" and rows[-1]["bill"]["number"] == r.json()["number"] and "total" in rows[-1]["bill"]
    assert c.get(f"{API}/accounts/{acc['id']}/history", params={"past": 0}).status_code == 422


def test_pdf_errors_and_the_visible_pdf_state(world):
    c, settings, db, store, mid, acc = world
    b = _draft(c, acc["id"])
    assert b["pdf"]["state"] in ("ready", "unavailable")

    def raiser(code, retryable):
        def fn(snapshot, **_k):
            raise bill_pdf.BillPdfError(code, retryable)
        return fn

    for code, status, retry in (("pdf_timeout", 503, True), ("pdf_render_failed", 503, True), ("pdf_page_limit", 422, False), ("pdf_too_large", 422, False)):
        pdfseam.set_renderer(raiser(code, retry))
        r = c.get(f"{API}/bills/{b['id']}/pdf")
        assert r.status_code == status and r.json()["code"] == code and r.json()["retryable"] is retry and r.json()["user_message"]
        got = c.get(f"{API}/bills/{b['id']}").json()["pdf"]
        assert got["state"] == "failed" and got["error_code"] == code and got["failed_at"]
    pdfseam.set_renderer(pdfseam.UNAVAILABLE)
    r = c.get(f"{API}/bills/{b['id']}/pdf")
    assert r.status_code == 503 and r.json()["code"] == "pdf_unavailable"
    assert c.get(f"{API}/bills/{b['id']}").json()["pdf"]["state"] == "unavailable"
    # a working renderer: the issued bill's PDF is stored once and the state says so
    pdfseam.set_renderer(lambda snapshot, **_k: b"%PDF-1.4 test")
    issued = c.post(f"{API}/bills/{b['id']}/issue", json={"row_version": c.get(f"{API}/bills/{b['id']}").json()["row_version"], "client_request_id": rid()}).json()
    assert issued["pdf"]["state"] == "failed" and issued["pdf"]["error_code"] == "pdf_unavailable"  # the last attempt failed
    assert c.get(f"{API}/bills/{b['id']}/pdf").status_code == 200
    bill = c.get(f"{API}/bills/{b['id']}").json()
    assert bill["pdf"]["state"] == "stored"
    actions = [e["action"] for e in c.get(f"{API}/bills/{b['id']}/events").json()["items"]]
    assert "pdf_failed" in actions and "pdf" in actions


def test_billing_settings_expose_the_pdf_engine_and_stay_out_of_the_generic_registry(world):
    c, settings, db, store, mid, acc = world
    s = c.get(f"{API}/billing-settings").json()
    assert {"configured", "active", "checked", "slow_fallbacks", "last_render_engine"} <= set(s["pdf_engine"])
    assert eb.SETTINGS_KEY in es.SPECS and es.SPECS[eb.SETTINGS_KEY].own_route == "/energy/billing-settings"
    g = c.get(f"{API}/settings").json()
    assert eb.SETTINGS_KEY not in g["values"] and eb.SETTINGS_KEY not in g["ranges"]
    r = c.patch(f"{API}/settings", json={eb.SETTINGS_KEY: {"revision": 0}})
    assert r.status_code == 422, "the billing document is edited only through /energy/billing-settings (revision and validation)"
    # one not-reporting threshold for the whole module
    assert c.patch(f"{API}/settings", json={"energy.stale_after_minutes": 30}).status_code == 200
    with db.connection(mode="read") as conn:
        assert eb.stale_after(conn) == dt.timedelta(minutes=30)


def test_logo_upload_uses_the_renderer_rules(world):
    c, settings, db, store, mid, acc = world
    from PIL import Image

    gif = io.BytesIO()
    Image.new("RGB", (10, 10)).save(gif, format="GIF")
    r = c.put(f"{API}/billing-settings/logo", content=gif.getvalue(), headers={"Content-Type": "image/png"})
    assert r.status_code == 422 and r.json()["code"] == "logo_invalid" and r.json()["details"]["code"] == "logo_type"
    png = io.BytesIO()
    Image.new("RGBA", (1600, 400), (10, 20, 30, 255)).save(png, format="PNG")
    r = c.put(f"{API}/billing-settings/logo", content=png.getvalue(), headers={"Content-Type": "image/png"})
    assert r.status_code == 200 and (r.json()["logo"]["width"], r.json()["logo"]["height"]) == (800, 200)


def test_weasyprint_over_five_seconds_falls_back_to_the_simple_engine(monkeypatch):
    from bill_pdf_samples import base

    calls: list[tuple[str, float]] = []

    def child(job, timeout_s):
        calls.append((job["engine"], timeout_s))
        if job["engine"] != "fpdf2":
            raise bill_pdf.BillPdfError("pdf_timeout")
        return b"%PDF-1.4 simple", "fpdf2"

    monkeypatch.setattr(bill_pdf, "_run_child", child)
    monkeypatch.delenv("SW_BILL_PDF_ENGINE", raising=False)
    monkeypatch.delenv("SW_BILL_PDF_FALLBACK_S", raising=False)
    before = bill_pdf.engine_status()["slow_fallbacks"]
    assert bill_pdf.render_bill_pdf(base()) == b"%PDF-1.4 simple"
    assert calls == [("auto", 5.0), ("fpdf2", 20.0)]
    st_ = bill_pdf.engine_status()
    assert st_["slow_fallbacks"] == before + 1 and st_["last_render_engine"] == "fpdf2"
    calls.clear()  # an explicit engine never falls back, and a total budget under 5 s is the plain timeout
    with pytest.raises(bill_pdf.BillPdfError):
        bill_pdf.render_bill_pdf(base(), engine="weasyprint")
    with pytest.raises(bill_pdf.BillPdfError):
        bill_pdf.render_bill_pdf(base(), timeout_s=3)
    assert calls == [("weasyprint", 20.0), ("auto", 3)]


def test_engine_self_check_reports_the_real_engine():
    pytest.importorskip("fpdf")
    s = bill_pdf.self_check(timeout_s=90)
    assert s["checked"] and s["active"] in ("weasyprint", "fpdf2"), s
    try:
        import weasyprint  # noqa: F401
        from weasyprint import HTML

        HTML(string="<p>x</p>").render()
        have_weasy = True
    except Exception:  # noqa: BLE001
        have_weasy = False
    assert (s["active"] == "weasyprint") == have_weasy, "a fallback to the simple engine is reported, never silent"


def test_one_backup_table_list():
    assert all(t in backup.PROJECT_TABLES for t in energy_backup.MAIN_TABLES)
    assert backup.PROJECT_TABLES.count("energy_meters") == 1 and "energy_bill_numbers" not in backup.PROJECT_TABLES
    assert energy_backup.KEEP_WHEN_ABSENT <= backup.KEEP_WHEN_ABSENT
    assert backup.FILE_COLUMNS["energy_bills"] == ["pdf_path"] and backup.FILE_COLUMNS["energy_assets"] == ["storage_path"]
    assert es.SPECS["energy.include_history_in_backup"].default is False  # owner: the full energy.db copy is off by default
