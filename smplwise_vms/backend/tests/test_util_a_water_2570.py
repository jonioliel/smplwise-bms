"""FIX-UTIL-A-2570: the water findings of the second deep review (docs/review/DEEP-REVIEW-2570-COMMS-UTILITIES.md).

CU2-07 a manual reading and its undo moved volume inside an already issued bill (electricity refuses); CU2-23 the customer create / patch
replies carried the contact fields to `water.manage` without `water.bills`; CU2-24 a price version could be moved back into a billed span,
and two managers' corrections silently overwrote each other; CU2-25 partially covered days in the abnormal-consumption baseline; CU2-26
the sampler dead after a quick OFF then ON; CU2-27 a draft's quarter-hours pruned under it, the sealed set parsed once per tariff; CU2-28 a
typed "1,500" read as 1.5. Fakes only (the module's own world); every test fails on v2.56.0 and passes after the fix."""
from __future__ import annotations

import datetime as dt
import json
import threading
import types

import pytest
from conftest import as_user, bind
import test_water_billing_s3 as _base
from test_water_billing_s3 import API, TZ, account, bill, local, setup_billing

from smplwise.db import Database, bump_permission_revision, new_id, now_iso
from smplwise.services import energy_store as st
from smplwise.services import water_billing as wb
from smplwise.services import water_meters as wm
from smplwise.services import water_runtime as wr
from smplwise.services import water_sampler

app = _base.app  # the module's own fixture, under its name


def _iso(ts: int) -> str:
    return dt.datetime.fromtimestamp(ts, dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _old_epochs(settings) -> None:
    """The meters were created today; their counter life starts before the fed September data (a meter added with its history)."""
    with Database(settings.db_path).connection() as conn:
        conn.execute("UPDATE water_meter_epochs SET started_at = '2026-08-01T00:00:00Z'")


def _issue(c, b: dict) -> dict:
    r = c.post(f"{API}/bills/{b['id']}/issue", json={"row_version": b["row_version"], "client_request_id": f"issue-{b['id'][:8]}"})
    assert r.status_code == 200, r.text
    return r.json()


# ---------------------------------------------------------------- CU2-07

def test_a_manual_reading_inside_an_issued_bill_is_recorded_only(app):
    c, settings = app
    ids = setup_billing(c, settings)
    _old_epochs(settings)
    acc = account(c, ids, "דירה 12", {"m": ids["apt"]})
    issued = _issue(c, bill(c, acc["id"]))
    with Database(settings.db_path).connection(mode="read") as conn:
        assert wb.billed_until(conn, ids["apt"]) == local(10, 1), "the issued September bill ends at local midnight of 1.10"
        assert wb.billed_until(conn, ids["garden"]) is None, "a meter outside the bill was never billed"
    at = local(9, 15) + 1800  # between two hourly reports (17.800 and 17.850 m3)
    body = {"read_at": _iso(at), "value": "17.820", "unit": "m3"}
    dry = c.post(f"{API}/meters/{ids['apt']}/manual-readings", json={**body, "dry_run": True})
    assert dry.status_code == 200 and (dry.json()["effect"], dry.json()["reason"]) == ("record", "billed"), dry.text
    r = c.post(f"{API}/meters/{ids['apt']}/manual-readings", json=body).json()
    assert (r["effect"], r["reason"]) == ("record", "billed")
    # the issued bill and a fresh computation of the same period still agree to the litre
    again = c.get(f"{API}/bills/{issued['id']}").json()
    assert again["m3"] == issued["m3"]
    # outside the billed span the reading is allocated as before
    garden = c.post(f"{API}/meters/{ids['garden']}/manual-readings", json={"read_at": _iso(at), "value": "7.730", "unit": "m3", "dry_run": True}).json()
    assert garden["effect"] == "allocation"


def test_undo_of_an_allocated_reading_is_refused_once_its_span_is_billed(app):
    c, settings = app
    ids = setup_billing(c, settings)
    _old_epochs(settings)
    acc = account(c, ids, "דירה 12", {"m": ids["apt"]})
    at = local(9, 20) + 1800
    r = c.post(f"{API}/meters/{ids['apt']}/manual-readings", json={"read_at": _iso(at), "value": "23.820", "unit": "m3"}).json()
    assert r["effect"] == "allocation", r
    _issue(c, bill(c, acc["id"]))
    u = c.post(f"{API}/meters/{ids['apt']}/manual-readings/{r['id']}/undo", json={"reason": "typo"})
    assert u.status_code == 409 and u.json()["code"] == "reading_billed", u.text
    assert u.json()["details"]["message_en"]


def test_undo_window_is_24_hours(app):
    c, settings = app
    ids = setup_billing(c, settings)
    _old_epochs(settings)
    at = local(10, 1, 2)  # two hours after the last report: an open gap
    r = c.post(f"{API}/meters/{ids['apt']}/manual-readings", json={"read_at": _iso(at), "value": "38.000", "unit": "m3"}).json()
    assert r["effect"] == "allocation", r
    with Database(settings.db_path).connection() as conn:
        conn.execute("UPDATE water_meter_manual_readings SET created_at = '2026-01-01T00:00:00Z' WHERE id = ?", (r["id"],))
    u = c.post(f"{API}/meters/{ids['apt']}/manual-readings/{r['id']}/undo", json={})
    assert u.status_code == 409 and u.json()["code"] == "undo_window_passed", u.text


# ---------------------------------------------------------------- CU2-23

def test_customer_replies_carry_contact_fields_only_with_water_bills(app):
    c, settings = app
    now = now_iso()
    with Database(settings.db_path).connection() as conn:
        conn.execute("INSERT INTO custom_roles(id, name_he, permissions_json, created_at, updated_at) VALUES ('cr-water-mgr', 'מנהל מים', ?, ?, ?)",
                     (json.dumps(["water.view", "water.manage"]), now, now))
        bump_permission_revision(conn)
    bind(c, settings, "wm", "cr-water-mgr", "installation", "*")
    cust = c.post(f"{API}/customers", json={"name": "רונית", "phone": "050-1234567", "email": "r@example.com", "address": "דירה 3"}).json()
    h = as_user("wm")
    p = c.patch(f"{API}/customers/{cust['id']}", json={"base_revision": cust["revision"]}, headers=h)
    assert p.status_code == 200, p.text
    text = json.dumps(p.json(), ensure_ascii=False)
    assert "050-1234567" not in text and "r@example.com" not in text and "דירה 3" not in text
    n = c.post(f"{API}/customers", json={"name": "יוסי", "phone": "052-7654321"}, headers=h)
    assert n.status_code == 201 and "052-7654321" not in json.dumps(n.json())
    assert "050-1234567" in json.dumps(c.get(f"{API}/customers/{cust['id']}").json()), "water.bills still sees them"


# ---------------------------------------------------------------- CU2-24

def test_a_version_cannot_move_back_into_a_billed_span_and_base_conflicts(app):
    c, settings = app
    ids = setup_billing(c, settings)
    tid = ids["tariff"]["id"]
    acc = account(c, ids, "דירה 12", {"m": ids["apt"]})
    _issue(c, bill(c, acc["id"]))                       # September sealed under V1 (from 1.1)
    v2 = c.post(f"{API}/tariffs/{tid}/versions", json={"effective_from": "2026-11-01", "water_price": "11.00", "sewage_price": "5.10"}).json()
    ver = next(v for v in v2["versions"] if v["effective_from"] == "2026-11-01")
    vid, mode = ver["id"], ver["price_mode"]
    moved = c.patch(f"{API}/tariffs/{tid}/versions/{vid}", json={"effective_from": "2026-09-15", "water_price": "11.00", "sewage_price": "5.10"})
    assert moved.status_code == 409 and moved.json()["code"] == "tariff_period_sealed", moved.text
    stale = c.patch(f"{API}/tariffs/{tid}/versions/{vid}", json={"effective_from": "2026-11-01", "water_price": "12.00", "sewage_price": "5.10",
                                                                   "base": {"effective_from": "2026-11-01", "water_price": "10.00", "sewage_price": "5.10", "price_mode": mode}})
    assert stale.status_code == 409 and stale.json()["code"] == "revision_conflict", stale.text
    ok = c.patch(f"{API}/tariffs/{tid}/versions/{vid}", json={"effective_from": "2026-11-15", "water_price": "12.00", "sewage_price": "5.10",
                                                                "base": {"effective_from": "2026-11-01", "water_price": "11.00", "sewage_price": "5.10", "price_mode": mode}})
    assert ok.status_code == 200, ok.text


# ---------------------------------------------------------------- CU2-25

class _Store:
    def __init__(self, days: dict[dt.date, tuple[int, int]]):
        self.days = days

    def daily(self, mid, a, b):
        return {d: v for d, v in self.days.items() if a <= d < b}

    def intervals(self, mid, a, b):
        return [(a, 700_000, 900, 0)]  # 700 L so far today


def test_abnormal_baseline_ignores_partially_covered_days():
    today = dt.date(2026, 10, 20)                       # a Tuesday
    tues = [today - dt.timedelta(days=7 * k) for k in (1, 2, 3, 4)]
    full = 86400
    days = {tues[0]: (400_000, full), tues[1]: (400_000, full), tues[2]: (20_000, 4 * 3600), tues[3]: (30_000, 3 * 3600)}
    m = {"id": "m1", "created_at": "2026-01-01T00:00:00Z"}
    rules = {"baseline_days": 35, "abnormal_factor": 2, "abnormal_min_l": 500}
    due = int(dt.datetime(2026, 10, 20, 12, 0, tzinfo=TZ).timestamp())
    out = wr.judge_abnormal(_Store(days), m, rules, due, TZ)
    assert out["baseline_n"] == 2 and out["median_ml"] == 400_000, "the two 3-4 hour days are not a baseline"
    assert out["fires"] is False, "700 L is not above twice the true 400 L median (it was, against the 215 L median of partial days)"


# ---------------------------------------------------------------- CU2-26

def test_sampler_restarts_after_a_quick_off_then_on(monkeypatch):
    monkeypatch.setenv("SW_WATER_SAMPLER", "1")
    s = water_sampler.Sampler()
    release = threading.Event()
    old = threading.Thread(target=release.wait, daemon=True)   # the old thread, still inside its tick
    old.start()
    s.thread = old
    s.shutdown()                                                # module OFF ...
    started: list[threading.Event] = []
    monkeypatch.setattr(s, "_run", lambda db, settings, stop=None: started.append(stop) or (stop or s.stop_evt).wait(5))
    assert s.start(types.SimpleNamespace(), types.SimpleNamespace(), assume_on=True) is True   # ... and ON again at once
    try:
        assert not s.stop_evt.is_set(), "the new thread does not inherit the stop"
        assert s.thread is not old and s.thread.is_alive()
    finally:
        release.set()
        s.shutdown()


# ---------------------------------------------------------------- CU2-27

def test_retention_keeps_the_quarter_hours_of_an_open_draft(app):
    c, settings = app
    ids = setup_billing(c, settings)
    acc = account(c, ids, "דירה 12", {"m": ids["apt"]})
    bill(c, acc["id"])                                   # a September DRAFT
    db = Database(settings.db_path)
    with db.connection(mode="read") as conn:
        keeps = water_sampler._draft_keeps(conn, TZ)
    assert (ids["apt"], local(9, 1), local(10, 1)) in keeps
    out = water_sampler.retention(db, settings, now=local(9, 1) + 3 * 365 * 86400)
    assert out["kept_drafts"] >= 1
    store = wm.store_for(settings)
    assert store.intervals(ids["apt"], local(9, 1), local(10, 1)), "the draft's quarter-hours are kept"
    assert not store.intervals(ids["garden"], local(9, 1), local(10, 1)), "a meter with no draft is pruned as before"


def test_tariff_listing_parses_the_sealed_set_once(app, monkeypatch):
    c, settings = app
    ids = setup_billing(c, settings)
    for i in range(3):
        assert c.post(f"{API}/tariffs", json={"name": f"תעריף {i}", "water_price": "9.00", "effective_from": "2026-01-01"}).status_code == 201
    calls = {"n": 0}
    real = wb._sealed_version_ids

    def counted(conn):
        calls["n"] += 1
        return real(conn)

    monkeypatch.setattr(wb, "_sealed_version_ids", counted)
    assert len(c.get(f"{API}/tariffs").json()["items"]) == 4
    assert calls["n"] == 1
    assert ids


# ---------------------------------------------------------------- CU2-28 a

def test_a_thousands_comma_is_refused_not_read_as_a_decimal():
    from smplwise.errors import ApiError

    for typed in ("1,500", "12,345,678"):
        with pytest.raises(ApiError) as e:
            wm.typed_ml(typed, "L")
        assert e.value.details["code"] == "ambiguous_comma" and e.value.details["message_en"]
    assert wm.typed_ml("4,5", "L") == 4500 and wm.typed_ml("1500", "L") == 1_500_000 and wm.typed_ml("1.5", "m3") == 1_500_000
    assert st is not None and new_id
