"""CR-023 P2: the electricity billing API end to end with fakes (readings store, clock, PDF renderer): customers, accounts,
tariffs and VAT, drafts, issue, numbering, corrections, cancellation, money hiding, history for the chart, the PDF seam,
automatic generation, retention and backup lists. No device, no Home Assistant, no real customer data."""
from __future__ import annotations

import datetime as dt
import hashlib
import io
import json
import threading
import uuid
from dataclasses import dataclass

import pytest
from fastapi.testclient import TestClient

from conftest import as_user, bind
from energy_billing_world import Clock, FakeReadings, fake_pdf, utc
from smplwise.db import Database
from smplwise.main import create_app
from smplwise.services import backup
from smplwise.services import energy_billing as eb
from smplwise.services import energy_billing_pdf as pdfseam
from smplwise.services.energy_billing_provider import set_provider

API = "/api/v1/energy"
# local midnights in Asia/Jerusalem (UTC+3 in summer, UTC+2 after 25.10.2026)
SEP1, OCT1, NOV1, DEC1, JAN1 = utc(2026, 8, 31, 21), utc(2026, 9, 30, 21), utc(2026, 10, 31, 22), utc(2026, 11, 30, 22), utc(2026, 12, 31, 22)


@dataclass
class W:
    c: TestClient
    r: FakeReadings
    clock: Clock
    settings: object
    db: Database


@pytest.fixture()
def w(settings, monkeypatch):
    fake = FakeReadings()
    fake.add_meter("m1", "לוח ראשי")
    fake.add_meter("m2", "מזגן לובי")
    set_provider(fake)
    pdfseam.set_renderer(fake_pdf)
    clock = Clock(utc(2026, 10, 2, 9))
    monkeypatch.setattr(eb, "now_utc", clock)
    monkeypatch.setattr(eb, "AUTO_EVERY_S", 0)
    app = create_app(settings)
    c = TestClient(app)
    assert c.get("/api/v1/me").status_code == 200  # bootstrap: the dev user is system_admin
    yield W(c, fake, clock, settings, Database(settings.db_path))
    set_provider(None)
    pdfseam.set_renderer(None)


def rid() -> str:
    return uuid.uuid4().hex


def golden_readings(w: W) -> None:
    """m1: 776.20 kWh in September 2026 (local), more in October; m2: 100 kWh in September."""
    w.r.read("m1", SEP1, 1_000_000)
    w.r.read("m1", utc(2026, 9, 15, 21), 1_388_100)
    w.r.read("m1", OCT1, 1_776_200)
    w.r.read("m1", utc(2026, 10, 1, 21), 1_800_000)
    w.r.read("m2", SEP1, 50_000)
    w.r.read("m2", OCT1, 150_000)
    w.r.read("m2", utc(2026, 10, 1, 21), 152_000)


def setup_billing(w: W, formula: str = "[לוח ראשי]", customer: dict | None = None, auto_mode: str = "draft", first: str = "2026-09-01") -> dict:
    c = w.c
    t = c.post(f"{API}/tariffs", json={"name": "תעריף כללי", "price": "0.5430", "price_mode": "ex_vat", "effective_from": "2026-01-01"})
    assert t.status_code == 201, t.text
    if not c.get(f"{API}/vat-rates").json()["items"]:
        assert c.post(f"{API}/vat-rates", json={"effective_from": "2025-01-01", "rate_percent": "18"}).status_code == 201
    cust = c.post(f"{API}/customers", json=customer or {"name": "לקוח בדיקה", "address": "רחוב בדיקה 1", "phone": "000", "email": "test@example.invalid"})
    assert cust.status_code == 201, cust.text
    acc = c.post(f"{API}/accounts", json={"name": "חשבון בדיקה", "customer_id": cust.json()["id"], "formula": {"text": formula},
                                           "tariff_id": t.json()["id"], "period_months": 1, "period_anchor_day": 1, "first_period_start": first, "auto_mode": auto_mode})
    assert acc.status_code == 201, acc.text
    return {"tariff": t.json(), "customer": cust.json(), "account": acc.json()}


def add_account(w: W, customer_id: str, tariff_id: str, formula: str = "[מזגן לובי]", name: str = "חשבון שני") -> dict:
    r = w.c.post(f"{API}/accounts", json={"name": name, "customer_id": customer_id, "formula": {"text": formula}, "tariff_id": tariff_id,
                                          "period_months": 1, "period_anchor_day": 1, "first_period_start": "2026-09-01"})
    assert r.status_code == 201, r.text
    return r.json()


def draft(w: W, aid: str, period: dict | None = None, request_id: str | None = None):
    body = {"client_request_id": request_id or rid()}
    if period:
        body["period"] = period
    return w.c.post(f"{API}/accounts/{aid}/bills", json=body)


def issue(w: W, bill: dict, request_id: str | None = None):
    return w.c.post(f"{API}/bills/{bill['id']}/issue", json={"row_version": bill["row_version"], "client_request_id": request_id or rid()})


SEPT = {"from": "2026-09-01", "to": "2026-09-30"}


# ---------------------------------------------------------------- the main flow

def test_golden_bill_draft_issue_number_due_date_and_sealed_snapshot(w):
    golden_readings(w)
    s = setup_billing(w)
    d = draft(w, s["account"]["id"], SEPT)
    assert d.status_code == 201, d.text
    b = d.json()
    snap = b["snapshot"]
    assert b["state"] == "draft" and b["number"] is None and snap["bill"]["number"] is None
    assert snap["totals"] == {**snap["totals"], "kwh": "776.20", "amount_ex_vat": "421.48", "vat_amount": "75.87", "total": "497.35"}
    assert snap["period"] == {"from": "2026-09-01", "to": "2026-09-30", "end_exclusive": "2026-10-01", "days": 30, "timezone": "Asia/Jerusalem",
                              "start_utc": "2026-08-31T21:00:00Z", "end_utc": "2026-09-30T21:00:00Z"}
    assert snap["doc"]["is_tax_invoice"] is False and snap["doc"]["subtitle_he"] == "אינו חשבונית מס"
    assert snap["meters"][0]["start"]["kind"] == "reading" and snap["meters"][0]["end"]["reading_kwh"] == "1776.200"
    assert snap["notes"] == []
    i = issue(w, b)
    assert i.status_code == 200, i.text
    bi = i.json()
    assert bi["state"] == "issued" and bi["number"] == "2026-09-0001"
    assert bi["issue_date"] == "2026-10-02" and bi["due_date"] == "2026-10-16"
    assert bi["snapshot_sha256"] == eb.sha256_of(bi["snapshot"]) and bi["snapshot"]["bill"]["number"] == "2026-09-0001"
    assert bi["snapshot"]["bill"]["issued_by"]["kind"] == "user"
    # immutable: later edits of the customer, business and price never touch the issued bill
    cust = w.c.get(f"{API}/customers/{s['customer']['id']}").json()
    assert w.c.patch(f"{API}/customers/{cust['id']}", json={"base_revision": cust["revision"], "name": "שם אחר"}).status_code == 200
    assert w.c.put(f"{API}/billing-settings", json={"business": {"name": "עסק אחר"}}).status_code == 200
    again = w.c.get(f"{API}/bills/{bi['id']}").json()
    assert again["snapshot"] == bi["snapshot"] and again["snapshot_sha256"] == bi["snapshot_sha256"]
    assert again["snapshot"]["customer"]["name"] == "לקוח בדיקה"
    # an issued bill is never recalculated or deleted
    assert w.c.post(f"{API}/bills/{bi['id']}/recalculate", json={"row_version": again["row_version"]}).json()["code"] == "bill_not_draft"
    assert w.c.delete(f"{API}/bills/{bi['id']}?row_version={again['row_version']}").json()["code"] == "bill_not_draft"
    ev = [e["action"] for e in w.c.get(f"{API}/bills/{bi['id']}/events").json()["items"]]
    assert ev == ["draft", "issue"]


def test_running_suffix_revision_suffix_and_cancelled_numbers_never_reused(w):
    golden_readings(w)
    s = setup_billing(w)
    second = add_account(w, s["customer"]["id"], s["tariff"]["id"])
    a = issue(w, draft(w, s["account"]["id"], SEPT).json()).json()
    b = issue(w, draft(w, second["id"], SEPT).json()).json()
    assert (a["number"], b["number"]) == ("2026-09-0001", "2026-09-0001/2")
    # correction of A: a draft revision 2; issuing it cancels A
    corr = w.c.post(f"{API}/bills/{a['id']}/correct", json={"client_request_id": rid()})
    assert corr.status_code == 201, corr.text
    cd = corr.json()
    assert cd["revision"] == 2 and cd["replaces_bill_id"] == a["id"] and cd["snapshot"]["bill"]["replaces"]["number"] == "2026-09-0001"
    assert w.c.post(f"{API}/bills/{a['id']}/correct", json={"client_request_id": rid()}).json()["code"] == "bill_state"
    ci = issue(w, cd).json()
    assert ci["number"] == "2026-09-0001-2"
    orig = w.c.get(f"{API}/bills/{a['id']}").json()
    assert orig["state"] == "void" and orig["void"]["reason"] == "הוחלף ב-2026-09-0001-2" and orig["replaced_by_bill_id"] == ci["id"]
    # cancel B, bill the same period again: a new running suffix, never the cancelled number
    assert w.c.post(f"{API}/bills/{b['id']}/void", json={"reason": ""}).json()["code"] == "reason_required"
    assert w.c.post(f"{API}/bills/{b['id']}/void", json={"reason": "נשלח בטעות"}).json()["state"] == "void"
    b2 = issue(w, draft(w, second["id"], SEPT).json()).json()
    assert b2["number"] == "2026-09-0001/3"
    # the customer number is locked once numbered bills exist
    cust = w.c.get(f"{API}/customers/{s['customer']['id']}").json()
    r = w.c.patch(f"{API}/customers/{cust['id']}", json={"base_revision": cust["revision"], "customer_number": "77"})
    assert r.status_code == 409 and r.json()["code"] == "customer_number_locked"


def test_two_bills_of_one_account_ending_in_the_same_month_and_overlap_refused(w):
    golden_readings(w)
    s = setup_billing(w)
    aid = s["account"]["id"]
    one = issue(w, draft(w, aid, {"from": "2026-09-01", "to": "2026-09-14"}).json()).json()
    two = issue(w, draft(w, aid, {"from": "2026-09-15", "to": "2026-09-30"}).json()).json()
    assert (one["number"], two["number"]) == ("2026-09-0001", "2026-09-0001/2")
    assert float(one["kwh"]) + float(two["kwh"]) == pytest.approx(776.20, abs=0.011)
    r = draft(w, aid, {"from": "2026-09-20", "to": "2026-10-10"})
    assert r.status_code == 409 and r.json()["code"] == "period_overlap" and r.json()["details"]["number"] in (one["number"], two["number"])


def test_double_click_create_and_issue_are_idempotent(w):
    golden_readings(w)
    s = setup_billing(w)
    req = rid()
    first = draft(w, s["account"]["id"], SEPT, req)
    second = draft(w, s["account"]["id"], SEPT, req)
    assert first.status_code == 201 and second.status_code == 200 and first.json()["id"] == second.json()["id"]
    other = draft(w, s["account"]["id"], SEPT)
    assert other.status_code == 409 and other.json()["code"] == "draft_exists"
    ireq = rid()
    i1 = issue(w, first.json(), ireq)
    i2 = issue(w, first.json(), ireq)
    assert i1.status_code == 200 and i2.status_code == 200 and i1.json()["number"] == i2.json()["number"]
    i3 = issue(w, first.json())
    assert i3.status_code == 409 and i3.json()["code"] == "bill_not_draft"
    assert w.db.connection  # one ledger row
    with w.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM energy_bill_numbers").fetchone()[0] == 1


def test_concurrent_issue_gives_distinct_numbers(w):
    golden_readings(w)
    s = setup_billing(w)
    accounts = [s["account"]["id"]] + [add_account(w, s["customer"]["id"], s["tariff"]["id"], name=f"חשבון {i}")["id"] for i in range(3)]
    drafts = [draft(w, a, SEPT).json() for a in accounts]
    results: list = []

    def go(b):
        results.append(issue(w, b))

    threads = [threading.Thread(target=go, args=(b,)) for b in drafts]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    numbers = sorted(r.json()["number"] for r in results if r.status_code == 200)
    assert numbers == ["2026-09-0001", "2026-09-0001/2", "2026-09-0001/3", "2026-09-0001/4"]


def test_revision_conflict_and_draft_stale_on_issue(w):
    s = setup_billing(w)
    w.r.read("m1", SEP1, 0)
    w.r.read("m1", utc(2026, 9, 20, 21), 200_000)
    b = draft(w, s["account"]["id"], SEPT).json()
    assert b["kwh"] == "200.00"
    assert w.c.post(f"{API}/bills/{b['id']}/issue", json={"row_version": b["row_version"] + 5, "client_request_id": rid()}).json()["code"] == "revision_conflict"
    # the silent meter reports after the draft was shown: 110 kWh over 11 days, 10 of them inside September
    w.r.read("m1", utc(2026, 10, 1, 21), 310_000)
    r = issue(w, b)
    assert r.status_code == 409 and r.json()["code"] == "draft_stale" and r.json()["details"]["new_kwh"] == "300.00"
    fresh = w.c.get(f"{API}/bills/{b['id']}").json()
    assert fresh["kwh"] == "300.00" and fresh["row_version"] == r.json()["details"]["row_version"]
    ok = issue(w, fresh)
    assert ok.status_code == 200 and ok.json()["number"] == "2026-09-0001"


def test_issue_only_after_the_period_ended(w):
    golden_readings(w)
    s = setup_billing(w)
    b = draft(w, s["account"]["id"], {"from": "2026-10-01", "to": "2026-10-31"}).json()  # a running period: a draft is fine
    r = issue(w, b)
    assert r.status_code == 422 and r.json()["code"] == "period_invalid"


# ---------------------------------------------------------------- formula, prices, VAT, DST, data notes

def test_negative_formula_is_refused_and_check_endpoint_reports_errors(w):
    golden_readings(w)
    s = setup_billing(w, formula="[מזגן לובי] - [לוח ראשי]")
    r = draft(w, s["account"]["id"], SEPT)
    assert r.status_code == 422 and r.json()["code"] == "formula_negative" and r.json()["details"]["kwh"] == "-676.20"
    chk = w.c.post(f"{API}/formula/check", json={"formula": {"text": "[לוח ראשי] - [מזגן לובי]"}, "period": SEPT}).json()
    assert chk["ok"] and chk["preview"]["result_kwh"] == "676.20" and chk["sentence_he"] == "לוח ראשי פחות מזגן לובי"
    neg = w.c.post(f"{API}/formula/check", json={"formula": {"text": "[מזגן לובי] - [לוח ראשי]"}, "period": SEPT}).json()
    assert not neg["ok"] and neg["preview"]["negative"] is True
    bad = w.c.post(f"{API}/formula/check", json={"formula": {"text": "([לוח ראשי] + "}}).json()
    assert not bad["ok"] and bad["errors"][0]["code"] in ("syntax", "unbalanced")
    mm = w.c.post(f"{API}/formula/check", json={"formula": {"text": "[לוח ראשי] * [מזגן לובי]"}}).json()
    assert mm["errors"][0]["code"] == "nonlinear"
    pre = w.c.post(f"{API}/formula/preset", json={"preset": "main_minus_subs", "meter_ids": ["m1", "m2"], "main_meter_id": "m1"}).json()
    assert pre["text"] == "[לוח ראשי] - [מזגן לובי]"
    # saving an invalid formula on an account is a 422 with the error list
    acc = w.c.get(f"{API}/accounts/{s['account']['id']}").json()
    r = w.c.patch(f"{API}/accounts/{acc['id']}", json={"base_revision": acc["revision"], "formula": {"text": "[לא קיים]"}})
    assert r.status_code == 422 and r.json()["code"] == "formula_invalid" and r.json()["details"]["errors"][0]["code"] == "unknown_meter"


def test_main_minus_sub_formula_bill(w):
    golden_readings(w)
    s = setup_billing(w, formula="[לוח ראשי] - [מזגן לובי]")
    snap = draft(w, s["account"]["id"], SEPT).json()["snapshot"]
    assert snap["totals"]["kwh"] == "676.20"
    assert [(m["meter_id"], m["coefficient"], m["contribution_kwh"]) for m in snap["meters"]] == [("m1", "1", "776.20"), ("m2", "-1", "-100.00")]


def test_vat_change_mid_period_splits_the_bill(w):
    golden_readings(w)
    s = setup_billing(w)
    assert w.c.post(f"{API}/vat-rates", json={"effective_from": "2026-09-16", "rate_percent": "17"}).status_code == 201
    snap = draft(w, s["account"]["id"], SEPT).json()["snapshot"]
    lines = snap["lines"]
    assert [(ln["from"], ln["to"], ln["vat_rate_percent"]) for ln in lines] == [("2026-09-01", "2026-09-15", "18"), ("2026-09-16", "2026-09-30", "17")]
    assert [ln["kwh"] for ln in lines] == ["388.10", "388.10"]
    assert [ln["vat_amount"] for ln in lines] == ["37.93", "35.83"] and snap["totals"]["vat_amount"] == "73.76"  # VAT per line, then summed
    assert any(n["code"] == "period_split" for n in snap["notes"])
    assert [b["rate_percent"] for b in snap["totals"]["vat_breakdown"]] == ["18", "17"]
    # a missing price for part of the period is a 422
    t = w.c.post(f"{API}/tariffs", json={"name": "מאוחר", "price": "1", "effective_from": "2026-09-10"}).json()
    acc = w.c.get(f"{API}/accounts/{s['account']['id']}").json()
    assert w.c.patch(f"{API}/accounts/{acc['id']}", json={"base_revision": acc["revision"], "tariff_id": t["id"]}).status_code == 200
    r = draft(w, acc["id"], {"from": "2026-09-01", "to": "2026-09-20"})
    assert r.status_code == 422 and r.json()["code"] == "tariff_missing" and r.json()["details"]["date"] == "2026-09-01"


def test_price_including_vat_mode(w):
    golden_readings(w)
    s = setup_billing(w)
    w.c.post(f"{API}/tariffs/{s['tariff']['id']}/versions", json={"effective_from": "2026-09-01", "price": "0.6407", "price_mode": "inc_vat"})
    snap = draft(w, s["account"]["id"], SEPT).json()["snapshot"]
    assert snap["totals"]["total"] == "497.31" and snap["totals"]["price_mode_note_he"] == "המחיר נקבע כולל מע״מ"


def test_dst_month_bill_uses_real_local_midnights(w):
    s = setup_billing(w)
    w.r.read("m1", OCT1, 0)
    w.r.read("m1", utc(2026, 10, 25, 0), 500_000)
    w.r.read("m1", NOV1, 745_000)  # one Wh-thousand per hour over the 745-hour October
    w.r.read("m1", utc(2026, 11, 1, 12), 760_000)
    w.clock.at = utc(2026, 11, 2, 9)
    snap = draft(w, s["account"]["id"], {"from": "2026-10-01", "to": "2026-10-31"}).json()["snapshot"]
    assert snap["period"]["start_utc"] == "2026-09-30T21:00:00Z" and snap["period"]["end_utc"] == "2026-10-31T22:00:00Z"
    assert snap["totals"]["kwh"] == "745.00"


def test_unreported_meter_note_then_carried_into_the_next_bill_exactly_once(w):
    s = setup_billing(w)
    w.r.read("m1", SEP1, 0)
    w.r.read("m1", utc(2026, 9, 25, 21), 250_000)  # silent from 26.09
    first = issue(w, draft(w, s["account"]["id"], SEPT).json()).json()
    snap = first["snapshot"]
    assert snap["totals"]["kwh"] == "250.00"
    note = [n for n in snap["notes"] if n["code"] == "meter_not_reporting"]
    assert note and "26.09.2026 00:00" in note[0]["text_he"]
    assert snap["meters"][0]["end"]["kind"] == "last_report" and snap["meters"][0]["reported_to_end"] is False
    # it reports again on 6.10 (10 days later, 100 kWh over the gap) and goes on
    w.r.read("m1", utc(2026, 10, 5, 21), 350_000)
    w.r.read("m1", NOV1, 400_000)
    w.r.read("m1", utc(2026, 11, 1, 6), 400_500)
    w.clock.at = utc(2026, 11, 2, 9)
    second = draft(w, s["account"]["id"], {"from": "2026-10-01", "to": "2026-10-31"}).json()["snapshot"]
    m = second["meters"][0]
    assert m["start"]["kind"] == "carried" and m["carried_in_kwh"] == "50.00"  # 5 of the 10 gap days (26.09-30.09 local) were in September
    assert second["totals"]["kwh"] == "150.00"  # 50 carried + 50 (1-5.10) + 50 (6-31.10)
    assert any(n["code"] == "carried_in" for n in second["notes"])
    assert float(snap["totals"]["kwh"]) + float(second["totals"]["kwh"]) == 400.0  # nothing lost, nothing twice


def test_correction_after_a_successor_keeps_the_original_end_points(w):
    s = setup_billing(w)
    w.r.read("m1", SEP1, 0)
    w.r.read("m1", utc(2026, 9, 25, 21), 250_000)
    sep = issue(w, draft(w, s["account"]["id"], SEPT).json()).json()
    w.r.read("m1", utc(2026, 10, 5, 21), 350_000)
    w.r.read("m1", NOV1, 400_000)
    w.clock.at = utc(2026, 11, 2, 9)
    octb = issue(w, draft(w, s["account"]["id"], {"from": "2026-10-01", "to": "2026-10-31"}).json()).json()
    corr = w.c.post(f"{API}/bills/{sep['id']}/correct", json={"client_request_id": rid()}).json()
    assert corr["kwh"] == "250.00"  # not 300: the October bill already billed the 50 carried kWh
    assert corr["snapshot"]["history"] == {**sep["snapshot"]["history"], "current": corr["snapshot"]["history"]["current"]}
    assert float(octb["kwh"]) + float(corr["kwh"]) == 400.0


# ---------------------------------------------------------------- history for the chart (owner round 3)

def test_history_first_bill_partial_missing_and_from_bills(w):
    s = setup_billing(w, first="2026-09-01")
    w.r.read("m1", SEP1, 0)
    w.r.read("m1", OCT1, 300_000)
    w.r.read("m1", NOV1, 700_000)
    w.r.read("m1", utc(2026, 11, 1, 6), 701_000)
    first = issue(w, draft(w, s["account"]["id"], SEPT).json()).json()["snapshot"]["history"]
    assert first["previous"] == [] and first["same_period_last_year"] is None  # first bill ever: no chart
    w.clock.at = utc(2026, 11, 2, 9)
    h = draft(w, s["account"]["id"], {"from": "2026-10-01", "to": "2026-10-31"}).json()["snapshot"]["history"]
    assert h["current"]["kwh"] == "400.00"
    assert h["previous"] == [{"from": "2026-09-01", "to": "2026-09-30", "kwh": "300.00", "status": "measured", "source": "bill"}]
    assert h["same_period_last_year"] is None


def test_history_from_readings_marks_partial_and_skips_missing(w):
    s = setup_billing(w, first="2026-09-01")
    w.r.read("m1", utc(2025, 10, 10, 21), 0)  # last year: from 11.10.2025 only -> partial
    w.r.read("m1", utc(2025, 10, 31, 22), 21_000)
    w.r.read("m1", utc(2026, 7, 31, 21), 100_000)  # August 2026 full; nothing between November 2025 and July 2026
    w.r.read("m1", SEP1, 131_000)
    w.r.read("m1", OCT1, 161_000)
    w.r.read("m1", NOV1, 191_000)
    w.r.read("m1", utc(2026, 11, 1, 6), 191_100)
    w.clock.at = utc(2026, 11, 2, 9)
    h = draft(w, s["account"]["id"], {"from": "2026-10-01", "to": "2026-10-31"}).json()["snapshot"]["history"]
    ly = h["same_period_last_year"]
    assert ly["status"] == "partial" and ly["kwh"] == "21.00" and ly["source"] == "readings"
    prev = {p["from"]: p for p in h["previous"]}
    assert prev["2026-09-01"]["kwh"] == "30.00" and prev["2026-08-01"]["kwh"] == "31.00"
    # the long gap Nov 2025 -> Jul 2026 is one covered segment: allocated by time, still measured (a counter closes gaps)
    assert all(p["kwh"] is None or p["status"] in ("measured", "partial") for p in h["previous"])
    assert h["previous"][0]["kwh"] is not None  # leading periods without any data are dropped


# ---------------------------------------------------------------- permissions and money hiding

def test_view_only_user_sees_no_money_and_every_bill_route_is_403_audited(w):
    golden_readings(w)
    s = setup_billing(w)
    b = issue(w, draft(w, s["account"]["id"], SEPT).json()).json()
    bind(w.c, w.settings, "op", "operator", "installation", "*")
    h = as_user("op")
    accs = w.c.get(f"{API}/accounts", headers=h)
    assert accs.status_code == 200
    blob = json.dumps(accs.json())
    for key in ('"price"', '"price_mode"', '"total"', '"amount_ex_vat"'):
        assert key not in blob
    cust = w.c.get(f"{API}/customers", headers=h).json()["items"][0]
    assert "phone" not in cust and "email" not in cust and "address" not in cust
    for method, path in (("get", "/bills"), ("get", f"/bills/{b['id']}"), ("get", f"/bills/{b['id']}/pdf"), ("get", "/tariffs"), ("get", "/billing-settings"),
                         ("get", "/vat-rates"), ("get", f"/accounts/{s['account']['id']}/bills")):
        r = getattr(w.c, method)(API + path, headers=h)
        assert r.status_code == 403, path
    # the permission is checked before the body: a garbage body still gets the 403, and it is audited
    r = w.c.post(f"{API}/accounts/{s['account']['id']}/bills", content=b"not json", headers={**h, "Content-Type": "text/plain"})
    assert r.status_code == 403
    r = w.c.post(f"{API}/bills/{b['id']}/void", json={"reason": "x"}, headers=h)
    assert r.status_code == 403
    r = w.c.post(f"{API}/customers", json={"name": "x"}, headers=h)
    assert r.status_code == 403
    with w.db.connection(mode="read") as conn:
        denied = conn.execute("SELECT action FROM audit_log WHERE actor_username = 'op' AND decision = 'denied'").fetchall()
    assert {"energy.bills", "energy.manage"} <= {d[0] for d in denied}
    st = w.c.get(f"{API}/accounts/{s['account']['id']}/status", headers=h).json()
    assert "amount_so_far" not in st


def test_energy_bills_is_sensitive_and_granted_by_default_to_admins_only():
    from smplwise.rbac import ROLES
    from smplwise.routers.access import PERMISSION_LABELS, SENSITIVE

    assert "energy.bills" in SENSITIVE
    for p in ("energy.view", "energy.manage", "energy.bills"):
        assert PERMISSION_LABELS[p]
    assert "energy.view" in ROLES["operator"] and "energy.bills" not in ROLES["operator"] and "energy.manage" not in ROLES["operator"]
    for role in ("site_admin", "system_admin"):
        assert {"energy.view", "energy.manage", "energy.bills"} <= set(ROLES[role])
    for role in ("viewer", "kiosk", "editor"):
        assert not any(p.startswith("energy.") for p in ROLES[role])


# ---------------------------------------------------------------- customers, settings, logo, lifecycle marks

def test_customer_numbers_padding_uniqueness_and_delete_rules(w):
    c = w.c
    a = c.post(f"{API}/customers", json={"name": "א"}).json()
    b = c.post(f"{API}/customers", json={"name": "ב", "customer_number": "12"}).json()
    assert a["customer_number"] == "0001" and b["customer_number"] == "0012"
    assert c.get(f"{API}/customers/next-number").json()["customer_number"] == "0013"
    r = c.post(f"{API}/customers", json={"name": "ג", "customer_number": "0012"})
    assert r.status_code == 409 and r.json()["code"] == "customer_number_taken"
    assert c.post(f"{API}/customers", json={"name": "ד", "customer_number": "12a"}).status_code == 422
    assert c.delete(f"{API}/customers/{b['id']}?base_revision={b['revision']}").status_code == 204
    r = c.post(f"{API}/customers", json={"name": "ה", "customer_number": "12"})
    assert r.status_code == 409  # a deleted customer's number is never reused
    s = setup_billing(w)
    cust = s["customer"]
    r = c.delete(f"{API}/customers/{cust['id']}?base_revision={cust['revision']}")
    assert r.status_code == 409 and r.json()["code"] == "customer_has_accounts"


def test_settings_payment_day_of_month_and_logo(w):
    golden_readings(w)
    s = setup_billing(w)
    st = w.c.get(f"{API}/billing-settings").json()
    r = w.c.put(f"{API}/billing-settings", json={"base_revision": st["revision"] + 1, "payment_terms": {"mode": "day_of_month"}})
    assert r.status_code == 409 and r.json()["code"] == "revision_conflict"
    r = w.c.put(f"{API}/billing-settings", json={"base_revision": st["revision"], "payment_terms": {"mode": "day_of_month", "day_of_month": 15},
                                                  "business": {"name": "עסק בדיקה", "accent_color": "#123456"}})
    assert r.status_code == 200 and r.json()["payment_terms"]["day_of_month"] == 15
    assert w.c.put(f"{API}/billing-settings", json={"business": {"accent_color": "red"}}).status_code == 422
    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (1600, 400), (10, 20, 30)).save(buf, format="PNG")
    up = w.c.put(f"{API}/billing-settings/logo", content=buf.getvalue(), headers={"Content-Type": "image/png"})
    assert up.status_code == 200, up.text
    logo = up.json()["logo"]
    assert logo["width"] == 800 and logo["height"] == 200
    assert w.c.put(f"{API}/billing-settings/logo", content=b"<svg/>", headers={"Content-Type": "image/png"}).json()["code"] == "logo_invalid"
    assert w.c.put(f"{API}/billing-settings/logo", content=b"x", headers={"Content-Type": "image/svg+xml"}).status_code == 415
    got = w.c.get(f"{API}/billing-settings/logo")
    assert got.status_code == 200 and hashlib.sha256(got.content).hexdigest() == logo["sha256"]
    b = issue(w, draft(w, s["account"]["id"], SEPT).json()).json()
    assert b["due_date"] == "2026-10-15" and b["snapshot"]["business"]["logo"]["sha256"] == logo["sha256"]
    assert b["snapshot"]["business"]["name"] == "עסק בדיקה"


def test_lifecycle_sent_paid_and_forbidden_transitions(w):
    golden_readings(w)
    s = setup_billing(w)
    b = issue(w, draft(w, s["account"]["id"], SEPT).json()).json()
    sent = w.c.post(f"{API}/bills/{b['id']}/sent", json={"how": "email"}).json()
    assert sent["state"] == "sent" and sent["sent"]["how"] == "email"
    paid = w.c.post(f"{API}/bills/{b['id']}/paid", json={"reference": "העברה 1"}).json()
    assert paid["state"] == "paid" and paid["actions"] == ["correct", "pdf"]
    r = w.c.post(f"{API}/bills/{b['id']}/void", json={"reason": "x"})
    assert r.status_code == 409 and r.json()["code"] == "bill_state"
    assert w.c.post(f"{API}/bills/{b['id']}/sent", json={"how": "hand"}).status_code == 409
    listing = w.c.get(f"{API}/bills").json()
    assert listing["counts"]["paid"] == 1 and listing["items"][0]["number"] == "2026-09-0001"
    assert w.c.get(f"{API}/bills", params={"q": "2026-09"}).json()["total"] == 1


# ---------------------------------------------------------------- PDF seam

def test_pdf_is_stored_once_for_an_issued_bill_and_watermarked_otherwise(w):
    golden_readings(w)
    s = setup_billing(w)
    d = draft(w, s["account"]["id"], SEPT).json()
    r = w.c.get(f"{API}/bills/{d['id']}/pdf")
    assert r.status_code == 200 and b"draft" in r.content and r.headers["content-type"] == "application/pdf"
    b = issue(w, d).json()
    r1 = w.c.get(f"{API}/bills/{b['id']}/pdf")
    assert r1.status_code == 200 and b"2026-09-0001 -" in r1.content and 'filename="2026-09-0001.pdf"' in r1.headers["content-disposition"]
    row = w.c.get(f"{API}/bills/{b['id']}").json()
    with w.db.connection(mode="read") as conn:
        stored = conn.execute("SELECT pdf_path, pdf_sha256 FROM energy_bills WHERE id = ?", (b["id"],)).fetchone()
    assert stored["pdf_path"].startswith("energy/bills/2026/") and stored["pdf_sha256"] == hashlib.sha256(r1.content).hexdigest()
    pdfseam.set_renderer(lambda snap, **k: (_ for _ in ()).throw(RuntimeError("boom")))
    assert w.c.get(f"{API}/bills/{b['id']}/pdf").content == r1.content  # served from the stored file
    copy = w.c.get(f"{API}/bills/{b['id']}/pdf?copy=1")
    assert copy.status_code == 503 and copy.json()["code"] == "pdf_render_failed" and copy.json()["retryable"] is True
    pdfseam.set_renderer(pdfseam.UNAVAILABLE)  # a build without any PDF engine (None means the real renderer since integration)
    assert w.c.get(f"{API}/bills/{b['id']}/pdf?copy=1").json()["code"] == "pdf_unavailable"
    assert row["state"] == "issued"


# ---------------------------------------------------------------- automatic generation

def _backdate(w: W, aid: str, created: str = "2026-08-15T00:00:00Z") -> None:
    with w.db.connection() as conn:
        conn.execute("UPDATE energy_accounts SET created_at = ? WHERE id = ?", (created, aid))


def test_auto_generation_catches_up_is_idempotent_and_respects_the_delay(w):
    golden_readings(w)
    s = setup_billing(w)
    aid = s["account"]["id"]
    _backdate(w, aid)
    # 1.10 01:00 local: September ended an hour ago, the default delay is 6 hours
    out = eb.auto_generate(w.db, now=utc(2026, 9, 30, 22))
    assert out.created == 0
    out = eb.auto_generate(w.db, now=utc(2026, 12, 2, 9))  # after downtime: September, October and November
    assert (out.created, out.failed) == (3, 0)
    again = eb.auto_generate(w.db, now=utc(2026, 12, 2, 9, 5))
    assert (again.created, again.skipped, again.failed) == (0, 0, 0)
    bills = w.c.get(f"{API}/bills", params={"account_id": aid}).json()["items"]
    assert sorted(b["period"]["from"] for b in bills) == ["2026-09-01", "2026-10-01", "2026-11-01"]
    assert all(b["state"] == "draft" and b["origin"] == "auto" for b in bills)
    runs = w.c.get(f"{API}/auto-runs").json()["items"]
    assert len(runs) == 3 and {r["status"] for r in runs} == {"created"}
    with w.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'energy.bill.auto_draft' AND actor_user_id IS NULL").fetchone()[0] == 3
    # a draft deleted by a person is not generated again
    sep = next(b for b in bills if b["period"]["from"] == "2026-09-01")
    assert w.c.delete(f"{API}/bills/{sep['id']}?row_version={sep['row_version']}").status_code == 204
    assert eb.auto_generate(w.db, now=utc(2026, 12, 3, 9)).created == 0


def test_auto_issue_mode_and_periods_before_the_account_existed(w):
    golden_readings(w)
    s = setup_billing(w, auto_mode="issue")
    aid = s["account"]["id"]
    _backdate(w, aid, "2026-10-20T00:00:00Z")  # created during October: September is never auto-generated
    out = eb.auto_generate(w.db, now=utc(2026, 11, 1, 6))
    assert (out.created, out.issued) == (1, 1)
    bills = w.c.get(f"{API}/bills", params={"account_id": aid}).json()["items"]
    assert len(bills) == 1 and bills[0]["state"] == "issued" and bills[0]["number"] == "2026-10-0001" and bills[0]["period"]["from"] == "2026-10-01"
    full = w.c.get(f"{API}/bills/{bills[0]['id']}").json()
    assert full["snapshot"]["bill"]["issued_by"] == {"kind": "system"} and full["snapshot_sha256"] == eb.sha256_of(full["snapshot"])


def test_auto_failure_is_recorded_and_retried_later(w):
    golden_readings(w)
    s = setup_billing(w)
    aid = s["account"]["id"]
    _backdate(w, aid)
    with w.db.connection() as conn:
        conn.execute("DELETE FROM energy_vat_rates")
    out = eb.auto_generate(w.db, now=utc(2026, 10, 2, 9))
    assert out.failed == 1
    run = w.c.get(f"{API}/auto-runs").json()["items"][0]
    assert run["status"] == "failed" and run["error_code"] == "vat_missing"
    w.c.post(f"{API}/vat-rates", json={"effective_from": "2025-01-01", "rate_percent": "18"})
    assert eb.auto_generate(w.db, now=utc(2026, 10, 2, 10)).created == 0  # before the retry time
    out = eb.auto_generate(w.db, now=utc(2026, 10, 2, 16))
    assert out.created == 1
    run = w.c.get(f"{API}/auto-runs").json()["items"][0]
    assert run["status"] == "created" and run["attempts"] == 2


def test_auto_restart_in_the_middle_leaves_nothing_and_concurrent_passes_make_one_draft(w, monkeypatch):
    golden_readings(w)
    s = setup_billing(w)
    aid = s["account"]["id"]
    _backdate(w, aid)
    real = eb.insert_draft

    def crash(*a, **k):
        real(*a, **k)
        raise RuntimeError("process killed")

    monkeypatch.setattr(eb, "insert_draft", crash)
    with pytest.raises(RuntimeError):
        eb.auto_generate(w.db, now=utc(2026, 10, 2, 9))
    with w.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM energy_bills").fetchone()[0] == 0
        assert conn.execute("SELECT COUNT(*) FROM energy_auto_runs").fetchone()[0] == 0
    monkeypatch.setattr(eb, "insert_draft", real)
    outs: list = []
    threads = [threading.Thread(target=lambda: outs.append(eb.auto_generate(w.db, now=utc(2026, 10, 2, 9)))) for _ in range(4)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert sum(o.created for o in outs) == 1
    with w.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM energy_bills WHERE account_id = ?", (aid,)).fetchone()[0] == 1


def test_janitor_tick_runs_the_billing_step(w):
    from smplwise.main import janitor_tick

    golden_readings(w)
    s = setup_billing(w)
    _backdate(w, s["account"]["id"])
    eb._LAST_AUTO.clear()
    janitor_tick(w.db, w.settings)
    with w.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM energy_bills").fetchone()[0] == 1


# ---------------------------------------------------------------- retention, backup

def test_retention_drops_old_drafts_and_bills_but_never_frees_a_number(w):
    golden_readings(w)
    s = setup_billing(w)
    b = issue(w, draft(w, s["account"]["id"], SEPT).json()).json()
    w.c.get(f"{API}/bills/{b['id']}/pdf")
    d = draft(w, s["account"]["id"], {"from": "2026-10-01", "to": "2026-10-31"}).json()
    out = eb.retention(w.db, w.settings.data_dir, now=utc(2026, 12, 1))
    assert out == {"drafts": 1, "bills": 0}
    out = eb.retention(w.db, w.settings.data_dir, now=utc(2034, 1, 1))
    assert out["bills"] == 1
    assert not list((w.settings.data_dir / "energy" / "bills").rglob("*.pdf"))
    with w.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM energy_bill_numbers WHERE number = '2026-09-0001'").fetchone()[0] == 1
    assert d["id"]


def test_backup_carries_billing_but_never_the_number_ledger(w):
    assert {"energy_customers", "energy_accounts", "energy_bills", "energy_tariff_versions", "energy_vat_rates", "energy_assets"} <= set(backup.PROJECT_TABLES)
    assert "energy_bill_numbers" not in backup.PROJECT_TABLES
    assert backup.FILE_COLUMNS["energy_bills"] == ["pdf_path"]
    assert "energy_bills" in backup.KEEP_WHEN_ABSENT
    golden_readings(w)
    s = setup_billing(w)
    issue(w, draft(w, s["account"]["id"], SEPT).json())
    with w.db.connection(mode="read") as conn:
        data = backup.snapshot(conn)
    assert len(data["energy_bills"]) == 1 and "energy_bill_numbers" not in data


# ---------------------------------------------------------------- correcting a price version

def _versions(w: W, tid: str) -> list[dict]:
    t = next(x for x in w.c.get(f"{API}/tariffs").json()["items"] if x["id"] == tid)
    return t["versions"]


def test_same_date_version_replaces_after_one_confirmation_and_is_audited(w):
    s = setup_billing(w)
    tid, vid = s["tariff"]["id"], s["tariff"]["versions"][0]["id"]
    body = {"effective_from": "2026-01-01", "price": "0.6600", "price_mode": "inc_vat"}
    r = w.c.post(f"{API}/tariffs/{tid}/versions", json=body)
    assert r.status_code == 200 and r.json()["applied"] is False and r.json()["plan"]["kind"] == "in_place"
    assert _versions(w, tid)[0]["price"] == "0.5430"  # nothing written before the confirmation
    r = w.c.post(f"{API}/tariffs/{tid}/versions", json={**body, "confirm": True, "base": {"effective_from": "2026-01-01", "price": "0.5430", "price_mode": "ex_vat"}})
    assert r.status_code == 200 and r.json()["applied"] is True
    vs = _versions(w, tid)
    assert len(vs) == 1 and vs[0]["id"] == vid and vs[0]["price"] == "0.6600" and vs[0]["price_mode"] == "inc_vat"
    with w.db.connection(mode="read") as conn:
        row = conn.execute("SELECT actor_user_id, details_json FROM audit_log WHERE action = 'energy.tariff.version.correct'").fetchone()
    d = json.loads(row["details_json"])
    assert row["actor_user_id"] and d["old"]["price"] == "0.5430" and d["new"]["price"] == "0.6600" and d["new"]["price_mode"] == "inc_vat"
    # an unchanged value is not a correction, and a stale base is a conflict
    assert w.c.post(f"{API}/tariffs/{tid}/versions", json={**body, "confirm": True}).json()["code"] == "nothing_changed"
    stale = w.c.post(f"{API}/tariffs/{tid}/versions", json={**body, "price": "0.7", "confirm": True, "replace_version_id": vid,
                                                            "base": {"effective_from": "2026-01-01", "price": "0.5430", "price_mode": "ex_vat"}})
    assert stale.status_code == 409 and stale.json()["code"] == "revision_conflict"


def test_correction_can_move_the_date_but_not_onto_another_version(w):
    s = setup_billing(w)
    tid = s["tariff"]["id"]
    w.c.post(f"{API}/tariffs/{tid}/versions", json={"effective_from": "2026-06-01", "price": "0.7", "price_mode": "ex_vat"})
    late = next(v for v in _versions(w, tid) if v["effective_from"] == "2026-06-01")
    ok = w.c.post(f"{API}/tariffs/{tid}/versions", json={"effective_from": "2026-07-01", "price": "0.7", "price_mode": "ex_vat", "replace_version_id": late["id"], "confirm": True})
    assert ok.status_code == 200 and sorted(v["effective_from"] for v in _versions(w, tid)) == ["2026-01-01", "2026-07-01"]
    clash = w.c.post(f"{API}/tariffs/{tid}/versions", json={"effective_from": "2026-01-01", "price": "0.7", "price_mode": "ex_vat", "replace_version_id": late["id"], "confirm": True})
    assert clash.status_code == 409 and clash.json()["code"] == "version_exists"


def test_correcting_a_price_a_sealed_bill_used_applies_only_to_later_periods(w):
    golden_readings(w)
    s = setup_billing(w)
    tid, vid = s["tariff"]["id"], s["tariff"]["versions"][0]["id"]
    sealed = issue(w, draft(w, s["account"]["id"], SEPT).json()).json()
    body = {"effective_from": "2026-01-01", "price": "0.6000", "price_mode": "ex_vat", "replace_version_id": vid}
    plan = w.c.post(f"{API}/tariffs/{tid}/versions", json=body).json()["plan"]
    assert plan["kind"] == "later_only" and plan["applies_from"] == "2026-10-01" and "החשבונות שכבר הופקו לא ישתנו" in plan["message_he"]
    r = w.c.post(f"{API}/tariffs/{tid}/versions", json={**body, "confirm": True})
    assert r.status_code == 200 and r.json()["applied"] is True
    vs = _versions(w, tid)
    assert [(v["effective_from"], v["price"]) for v in vs] == [("2026-01-01", "0.5430"), ("2026-10-01", "0.6000")]
    assert w.c.get(f"{API}/bills/{sealed['id']}").json()["snapshot_sha256"] == sealed["snapshot_sha256"]
    # October (unbilled) uses the corrected price
    snap = draft(w, s["account"]["id"], {"from": "2026-10-01", "to": "2026-10-01"}).json()["snapshot"]
    assert snap["lines"][0]["price_entered"] == "0.6000"


def test_correction_refused_when_a_later_version_leaves_no_room_after_sealed_periods(w):
    golden_readings(w)
    s = setup_billing(w)
    tid, vid = s["tariff"]["id"], s["tariff"]["versions"][0]["id"]
    w.c.post(f"{API}/tariffs/{tid}/versions", json={"effective_from": "2026-10-01", "price": "0.9", "price_mode": "ex_vat"})
    issue(w, draft(w, s["account"]["id"], SEPT).json())
    r = w.c.post(f"{API}/tariffs/{tid}/versions", json={"effective_from": "2026-01-01", "price": "0.6", "price_mode": "ex_vat", "replace_version_id": vid, "confirm": True})
    assert r.status_code == 409 and r.json()["code"] == "tariff_period_sealed" and _versions(w, tid)[0]["price"] == "0.5430"


def test_correcting_a_price_needs_energy_manage(w):
    s = setup_billing(w)
    bind(w.c, w.settings, "op", "operator", "installation", "*")
    r = w.c.post(f"{API}/tariffs/{s['tariff']['id']}/versions", json={"effective_from": "2026-01-01", "price": "0.7", "confirm": True}, headers=as_user("op"))
    assert r.status_code == 403
    assert _versions(w, s["tariff"]["id"])[0]["price"] == "0.5430"
