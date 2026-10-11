"""BILL-start-reading (owner bug 2026-10-11): the bill's "reading at the start of the period" column was empty (PDF "-", screen "0.00")
for meters that were added to the system during the period - the readings store had no reading at or just before the period start,
so the opening anchor was "none" although the consumption (from the meter's first reading on) was billed.

Now: the opening reading is the reading at the period start (exact or interpolated), the end of the previous bill (carried), or - for
a meter that began reporting inside the period - its FIRST stored reading, at its own instant; end - start = consumption. When no
reading is known the bill says "לא נקלט", and an administrator may type the physical meter's opening reading (an audited EL6 manual
reading before the counter's first reading, "head_gap"): its energy up to the first reading joins the bill. Fake data only; no device."""
from __future__ import annotations

import datetime as dt
import json
from decimal import Decimal

import pytest

from energy_billing_world import FakeReadings, utc
from smplwise.services import bill_pdf_html
from smplwise.services import energy_billing as eb
from smplwise.services import energy_provider as ep
from smplwise.services.bill_pdf_model import BillSnapshot
from smplwise.services.energy_consumption import meter_window
from test_energy_store import TZ, add_meter, feed, local, ts

API = "/api/v1/energy"
UTC = dt.timezone.utc
D = Decimal


def iso(x: dt.datetime) -> str:
    return x.astimezone(UTC).isoformat().replace("+00:00", "Z")


# ---------------------------------------------------------------- the engine (fake readings)

def test_opening_is_the_reading_at_or_just_before_the_period_start():
    r = FakeReadings()
    r.add_meter("m", "מונה")
    r.read("m", utc(2026, 9, 30, 20, 55), 1_000_000)  # 5 minutes before the start: a real reading at the boundary
    r.read("m", utc(2026, 10, 10), 1_100_000)
    w = meter_window(r, "m", [utc(2026, 9, 30, 21), utc(2026, 10, 10)])
    assert w.start.kind == "reading" and w.start.at == utc(2026, 9, 30, 21)
    assert w.end.reading_wh - w.start.reading_wh == pytest.approx(w.wh, abs=1)


def test_opening_from_the_previous_period_is_its_closing_reading():
    r = FakeReadings()
    r.add_meter("m", "מונה")
    r.read("m", utc(2026, 9, 1), 0)
    r.read("m", utc(2026, 9, 25), 24_000)  # then silent past the boundary
    w1 = meter_window(r, "m", [utc(2026, 9, 1), utc(2026, 10, 1)])
    r.read("m", utc(2026, 10, 5), 34_000)
    w2 = meter_window(r, "m", [utc(2026, 10, 1), utc(2026, 11, 1)], carried_from=w1.end.at)
    assert w2.start.kind == "carried" and w2.start.at == w1.end.at and w2.start.reading_wh == w1.end.reading_wh == 24_000
    assert w2.end.reading_wh - w2.start.reading_wh == w2.wh == 10_000


def test_opening_of_a_meter_added_during_the_period_is_its_first_reading():
    """The owner's case: the meter's first reading came hours after the period's first instant."""
    r = FakeReadings()
    r.add_meter("m", "מזגן")
    first = utc(2026, 10, 4, 11)  # 14:00 local, the period starts at 00:00 local (21:00Z the day before)
    r.read("m", first, 593_670)
    r.read("m", utc(2026, 10, 7), 600_000)
    r.read("m", utc(2026, 10, 11, 6), 607_520)
    w = meter_window(r, "m", [utc(2026, 10, 3, 21), utc(2026, 10, 31, 22)])
    assert (w.start.kind, w.start.at, w.start.reading_wh) == ("first_reading", first, 593_670)
    assert w.wh == 13_850 and w.end.reading_wh - w.start.reading_wh == w.wh
    assert w.end.kind == "last_report" and not w.reported_to_end


def test_opening_unknown_when_the_meter_never_reported():
    r = FakeReadings()
    r.add_meter("m", "מונה")
    w = meter_window(r, "m", [utc(2026, 10, 1), utc(2026, 11, 1)])
    assert w.start.kind == "none" and w.start.reading_wh is None and w.wh == 0


def test_a_reading_before_the_start_that_is_too_old_is_not_replaced_by_a_later_one():
    """Only a meter with NO earlier reading takes its first reading as the opening; a meter that reported long before keeps the
    time-allocated value (here: interpolated across the gap)."""
    r = FakeReadings()
    r.add_meter("m", "מונה")
    r.read("m", utc(2026, 9, 20), 1_000)
    r.read("m", utc(2026, 10, 10), 21_000)
    w = meter_window(r, "m", [utc(2026, 9, 30), utc(2026, 10, 20)])
    assert w.start.kind == "interpolated" and w.start.reading_wh == 11_000


# ---------------------------------------------------------------- the real store, the bill and the API

@pytest.fixture()
def opening_world(settings, monkeypatch):
    from fastapi.testclient import TestClient

    from smplwise.db import Database
    from smplwise.main import create_app
    from smplwise.services import energy_billing_pdf as pdfseam
    from smplwise.services import energy_store as st
    from smplwise.services.energy_billing_provider import set_provider

    set_provider(None)
    pdfseam.set_renderer(None)
    monkeypatch.setattr(eb, "now_utc", lambda: dt.datetime(2026, 9, 11, 9, 0, tzinfo=UTC))
    monkeypatch.setattr(eb, "AUTO_EVERY_S", 10**9)
    c = TestClient(create_app(settings))
    assert c.get("/api/v1/me").status_code == 200  # bootstrap: system_admin
    db = Database(settings.db_path)
    store = st.store_for(settings)
    # both meters were added at 14:00 on the first day of the period; they report from then on
    created = iso(local(2026, 9, 4, 14))
    ac, el = add_meter(db, "מזגן סטודיו", created=created), add_meter(db, "חשמל סטודיו", created=created)
    feed(store, ac, [(local(2026, 9, 4, 14, 5), 593_670), (local(2026, 9, 7), 600_000), (local(2026, 9, 11, 6), 607_520)])
    feed(store, el, [(local(2026, 9, 4, 14, 5), 277_890), (local(2026, 9, 8), 290_000), (local(2026, 9, 11, 6), 308_490)])
    t = c.post(f"{API}/tariffs", json={"name": "כללי", "price": "0.5000", "price_mode": "ex_vat", "effective_from": "2025-01-01"})
    assert c.post(f"{API}/vat-rates", json={"effective_from": "2025-01-01", "rate_percent": "18"}).status_code == 201
    cust = c.post(f"{API}/customers", json={"name": "לקוח בדיקה"})
    acc = c.post(f"{API}/accounts", json={"name": "יחידה", "customer_id": cust.json()["id"], "formula": {"text": "[מזגן סטודיו] + [חשמל סטודיו]"},
                                          "tariff_id": t.json()["id"], "period_months": 1, "period_anchor_day": 1, "first_period_start": "2026-09-04",
                                          "auto_mode": "off"})
    assert acc.status_code == 201, acc.text
    yield c, settings, db, store, ac, el, acc.json()
    pdfseam.set_renderer(None)


def _draft(c, aid):
    r = c.post(f"{API}/accounts/{aid}/bills", json={"period": {"from": "2026-09-04", "to": "2026-09-30"}, "client_request_id": "x" * 32})
    assert r.status_code == 201, r.text
    return r.json()


def _meter(bill, mid):
    return next(m for m in bill["snapshot"]["meters"] if m["meter_id"] == mid)


def test_first_period_of_new_meters_has_real_opening_readings_and_consistent_arithmetic(opening_world):
    c, settings, db, store, ac, el, acc = opening_world
    b = _draft(c, acc["id"])
    a, e = _meter(b, ac), _meter(b, el)
    # regression: before the fix both openings were null ("-" in the PDF, "0.00" on screen)
    assert a["start"] == {"at": iso(local(2026, 9, 4, 14, 5)), "reading_kwh": "593.670", "kind": "first_reading"}
    assert e["start"]["reading_kwh"] == "277.890" and e["start"]["kind"] == "first_reading"
    for m in (a, e):
        assert D(m["end"]["reading_kwh"]) - D(m["start"]["reading_kwh"]) == D(m["consumption_kwh"])
    assert (a["consumption_kwh"], e["consumption_kwh"]) == ("13.85", "30.60")
    codes = [n["code"] for n in b["snapshot"]["notes"]]
    assert codes.count("opening_first_reading") == 2 and "opening_unknown" not in codes and "reading_difference" not in codes
    note = next(n for n in b["snapshot"]["notes"] if n["code"] == "opening_first_reading" and n["meter_id"] == ac)
    assert "04.09.2026 14:05" in note["text_he"]
    # the PDF model prints the numbers, never a dash or "לא נקלט"
    doc = BillSnapshot.from_billing_snapshot(b["snapshot"])
    assert [m.start_reading for m in doc.meters] == [D("593.670"), D("277.890")]
    html = bill_pdf_html.build_html(doc, False)
    assert "593.67" in html and bill_pdf_html.NOT_CAPTURED not in html
    assert any("הקריאה הראשונה שנקלטה" in n for n in doc.notes)
    # the account status screen stays clean (no opening notes there)
    st_notes = c.get(f"{API}/accounts/{acc['id']}/status").json()["notes"]
    assert not [n for n in st_notes if n["code"] == "opening_first_reading"]


def test_an_administrator_enters_the_opening_reading_audited_and_undoable(opening_world):
    c, settings, db, store, ac, el, acc = opening_world
    b = _draft(c, acc["id"])
    start_utc = b["snapshot"]["period"]["start_utc"]
    assert start_utc == iso(local(2026, 9, 4))
    # the physical meter showed 590.00 kWh at 00:00 on the first day (before the meter was added at 14:00 - allowed for an opening)
    r = c.post(f"{API}/meters/{ac}/manual-readings", json={"read_at": start_utc, "value": "590", "unit": "kWh", "note": "קריאת פתיחה"})
    assert r.status_code == 200, r.text
    got = r.json()["reading"]
    assert (got["effect"], got["effect_reason"], got["span_from"]) == ("allocation", "head_gap", start_utc) and got["message"]
    with db.connection(mode="read") as conn:
        row = conn.execute("SELECT details_json FROM audit_log WHERE action = 'energy.meter.manual_reading' AND decision = 'allowed'").fetchone()
    assert json.loads(row["details_json"])["effect"] == "allocation"
    b2 = c.post(f"{API}/bills/{b['id']}/recalculate", json={"row_version": b["row_version"]})
    assert b2.status_code == 200, b2.text
    m = _meter(b2.json(), ac)
    assert m["start"] == {"at": start_utc, "reading_kwh": "590.000", "kind": "manual"}
    assert m["consumption_kwh"] == "17.52" and D(m["end"]["reading_kwh"]) - D(m["start"]["reading_kwh"]) == D("17.52")
    notes = b2.json()["snapshot"]["notes"]
    assert any(n["code"] == "manual_reading" and n["meter_id"] == ac for n in notes)
    assert not any(n["code"] == "opening_first_reading" and n["meter_id"] == ac for n in notes)
    # undo puts the series back: the opening is the first reading again
    u = c.post(f"{API}/meters/{ac}/manual-readings/{got['id']}/undo", json={"reason": "בדיקה"})
    assert u.status_code == 200, u.text
    b3 = c.post(f"{API}/bills/{b['id']}/recalculate", json={"row_version": b2.json()["row_version"]})
    m = _meter(b3.json(), ac)
    assert m["start"]["kind"] == "first_reading" and m["consumption_kwh"] == "13.85"


def test_opening_reading_rules(opening_world):
    c, settings, db, store, ac, el, acc = opening_world
    url = f"{API}/meters/{ac}/manual-readings"
    # before the meter was added only a usable opening is accepted: one above the counter's first reading is refused
    r = c.post(url, json={"read_at": iso(local(2026, 9, 4)), "value": "600", "unit": "kWh"})
    assert r.status_code == 422 and r.json()["code"] == "validation"
    # long before the meter was added (more than two monthly periods): refused as before
    r = c.post(url, json={"read_at": iso(local(2026, 6, 1)), "value": "500", "unit": "kWh"})
    assert r.status_code == 422 and r.json()["code"] == "validation"
    # a dry run of a good opening answers what it would do and saves nothing
    r = c.post(f"{API}/meters/{el}/manual-readings", json={"read_at": iso(local(2026, 9, 4)), "value": "270", "unit": "kWh", "dry_run": True})
    assert r.status_code == 200 and r.json()["reading"]["effect_reason"] == "head_gap" and r.json()["reading"]["id"] is None
    assert c.get(f"{API}/meters/{el}/manual-readings").json()["items"] == []


def test_head_gap_in_the_store_is_exact_and_undo_restores_every_bucket(settings):
    from smplwise.db import Database
    from smplwise.services import energy_store as st

    db = Database(settings.db_path)
    db.migrate()
    store = st.store_for(settings)
    a, twin = add_meter(db, "א"), add_meter(db, "תאום")
    pts = [(local(2026, 9, 4, 14), 593_670), (local(2026, 9, 5), 600_000)]
    feed(store, a, pts)
    feed(store, twin, pts)
    window = (local(2026, 9, 3), local(2026, 9, 6))
    before = [(bk, wh, cov) for bk, wh, cov, _q in store.intervals(a, ts(window[0]), ts(window[1]))]
    p = store.manual_reading(a, ts=ts(local(2026, 9, 4)), raw_wh=590_000, max_kw=100.0, epoch_lo=0, epoch_hi=None, billed_until=None, tz=TZ)
    assert (p.effect, p.reason, p.prev, p.next) == ("allocation", "head_gap", None, (ts(local(2026, 9, 4, 14)), 593_670))
    full = store.consumption(a, ts(local(2026, 9, 4)), ts(local(2026, 9, 4, 14)), tz=TZ, interval_floor=None)
    assert full["wh"] == 3_670 and full["covered_s"] == full["total_s"]
    assert store.cursor_info([a])[a].last_ts == ts(local(2026, 9, 5))  # the counter's latest reading is untouched
    with db.connection(mode="read") as conn:
        w = meter_window(ep.EnergyProvider(conn, store, now=local(2026, 9, 6).timestamp()), a, [local(2026, 9, 4).astimezone(UTC), local(2026, 9, 5).astimezone(UTC)])
    assert (w.start.kind, w.start.reading_wh, w.wh) == ("reading", 590_000, 10_000)
    # a billed range is never reshaped; a value above the first reading is recorded only
    assert store.manual_reading(a, ts=ts(local(2026, 9, 3)), raw_wh=580_000, max_kw=100.0, epoch_lo=0, epoch_hi=None,
                                billed_until=ts(local(2026, 9, 5)), tz=TZ, dry_run=True).reason == "billed"
    assert store.manual_reading(twin, ts=ts(local(2026, 9, 4)), raw_wh=600_000, max_kw=100.0, epoch_lo=0, epoch_hi=None,
                                billed_until=None, tz=TZ, dry_run=True).reason == "outside_counter"
    assert store.undo_manual_reading(a, ts=ts(local(2026, 9, 4)), raw_wh=590_000, epoch_lo=0, epoch_hi=None, tz=TZ) is None
    assert [(bk, wh, cov) for bk, wh, cov, _q in store.intervals(a, ts(window[0]), ts(window[1]))] == before
    assert store.daily(a, dt.date(2026, 9, 3), dt.date(2026, 9, 6)) == store.daily(twin, dt.date(2026, 9, 3), dt.date(2026, 9, 6))


# ---------------------------------------------------------------- the printed bill

def _snapshot(start_reading, kind="none", notes=()):
    import bill_pdf_samples as S

    data = S.base()
    data["meters"][0]["start"] = {"at": "2026-08-31T21:00:00Z", "reading_kwh": start_reading, "kind": kind}
    data["notes"] = list(data.get("notes") or []) + list(notes)
    return data


def test_pdf_prints_not_captured_instead_of_a_dash_and_the_arithmetic_sentence():
    doc = BillSnapshot.from_billing_snapshot(_snapshot(None, notes=[{"code": "opening_unknown", "meter_id": "m1", "text_he": "קריאת הפתיחה של המונה לוח לא נקלטה."}]))
    assert doc.meters[0].start_reading is None
    assert bill_pdf_html.reading(None) == "לא נקלט"
    html = bill_pdf_html.build_html(doc, False)
    assert "<td class='n'>לא נקלט</td>" in html and "<td class='n'>-</td>" not in html
    assert "קריאת הסוף פחות קריאת הפתיחה" in html and "קריאת הפתיחה של המונה לוח לא נקלטה." in html


def _pdftotext(pdf: bytes) -> str:
    import re
    import shutil
    import subprocess

    if not shutil.which("pdftotext"):
        pytest.skip("poppler-utils (pdftotext) not installed")
    out = subprocess.run(["pdftotext", "-", "-"], input=pdf, capture_output=True, check=True).stdout.decode()
    return " ".join(re.sub("[‎‏‪-‮⁦-⁩]", "", out).split())


@pytest.mark.parametrize("engine", ["weasyprint", "fpdf2"])
def test_rendered_pdf_prints_the_first_reading_and_not_captured(engine):
    import bill_pdf_samples as S
    from smplwise.services.bill_pdf import BillPdfError, render_bill_pdf

    pytest.importorskip("weasyprint" if engine == "weasyprint" else "fpdf")
    try:
        pdf = render_bill_pdf(S.opening(), engine=engine)
    except BillPdfError as exc:  # pragma: no cover - an engine that cannot load here (no system libraries)
        pytest.skip(f"{engine} cannot render here: {exc}")
    text = _pdftotext(pdf)
    assert "12,480.62" in text and "לא נקלט" in text and "קריאה בתחילת התקופה" in text
    assert "הקריאה הראשונה שנקלטה" in text and "04.09.2026 14:05" in text
