"""EL6: manual readings of the physical meter and calibration of the system counter against it.

Store: a manual reading closes an open reporting gap or re-splits a closed one (the same total), everything else is recorded
only, and an undo puts the buckets back exactly. Provider: the calibration factor applies from its date on, history is never
rewritten, consumption stays additive (contiguous windows sum to the whole), readings leave on the physical scale. API: the
validation (future, before the meter, units, monotonic, duplicate), dry run, audit with who / when, the 24-hour undo window, the
billed guard, RBAC (403 before the body). Billing: the calibrated energy and readings on the bill, its notes and the PDF model,
and a manual reading that lets a bill reach the end of the period. Fake readings only; no device."""
from __future__ import annotations

import datetime as dt
import json
import uuid

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.db import Database, new_id
from smplwise.services import energy_calibration as ecal
from smplwise.services import energy_provider as ep
from smplwise.services import energy_store as st
from smplwise.services.energy_consumption import meter_window
from test_energy_store import TZ, add_meter, feed, local, ts

UTC = dt.timezone.utc
API = "/api/v1/energy"


def iso(x: dt.datetime) -> str:
    return x.astimezone(UTC).isoformat().replace("+00:00", "Z")


@pytest.fixture()
def env(settings):
    db = Database(settings.db_path)
    db.migrate()
    return db, st.store_for(settings), settings


def buckets(store: st.EnergyStore, mid: str, a: dt.datetime, b: dt.datetime) -> list[tuple[int, int, int]]:
    return [(bk, wh, cov) for bk, wh, cov, _q in store.intervals(mid, ts(a), ts(b))]


def daily(store: st.EnergyStore, mid: str, a: dt.date, b: dt.date) -> dict[dt.date, tuple[int, int]]:
    return {d: (wh, cov) for d, (wh, cov, _s) in store.daily(mid, a, b).items()}


def raw_wh(store: st.EnergyStore, mid: str, a: dt.datetime, b: dt.datetime) -> int | None:
    return store.consumption(mid, ts(a), ts(b), tz=TZ, interval_floor=None)["wh"]


def plan(store, mid, at, value, *, billed=None, dry=False):
    return store.manual_reading(mid, ts=ts(at), raw_wh=value, max_kw=100.0, epoch_lo=0, epoch_hi=None, billed_until=billed, tz=TZ, dry_run=dry)


# ---------------------------------------------------------------- the store

def test_open_gap_reading_extends_the_counter_and_undo_restores(env):
    db, store, _ = env
    a, twin = add_meter(db, "א"), add_meter(db, "תאום")
    pts = [(local(2026, 9, 1), 1_000_000), (local(2026, 9, 1, 0, 15), 1_000_250)]
    feed(store, a, pts)
    feed(store, twin, pts)
    m = local(2026, 9, 3, 12)
    assert plan(store, a, m, 1_060_250, dry=True).effect == "allocation"
    assert raw_wh(store, a, local(2026, 9, 1, 0, 15), m) is None  # dry run changed nothing
    p = plan(store, a, m, 1_060_250)
    assert (p.effect, p.reason, p.prev, p.next) == ("allocation", "open_gap", (ts(pts[1][0]), 1_000_250), None)
    r = store.consumption(a, ts(local(2026, 9, 1, 0, 15)), ts(m), tz=TZ, interval_floor=None)
    assert r["wh"] == 60_000 and r["covered_s"] == r["total_s"]
    info = store.cursor_info([a])[a]
    assert (info.last_ts, info.last_value_wh, info.seen_ts) == (ts(m), 1_060_250, ts(pts[1][0]))  # the last REPORT is unchanged
    # the meter reports again: it counts from the typed value
    feed(store, a, [(local(2026, 9, 4), 1_070_250)])
    feed(store, twin, [(local(2026, 9, 4), 1_070_250)])
    assert raw_wh(store, a, m, local(2026, 9, 4)) == 10_000
    assert raw_wh(store, a, local(2026, 9, 1), local(2026, 9, 4)) == raw_wh(store, twin, local(2026, 9, 1), local(2026, 9, 4)) == 70_250
    # undo: one linear span again, bucket for bucket the same as the twin that never had the reading
    assert store.undo_manual_reading(a, ts=ts(m), raw_wh=1_060_250, epoch_lo=0, epoch_hi=None, tz=TZ) is None
    assert buckets(store, a, local(2026, 9, 1), local(2026, 9, 5)) == buckets(store, twin, local(2026, 9, 1), local(2026, 9, 5))
    assert daily(store, a, dt.date(2026, 9, 1), dt.date(2026, 9, 5)) == daily(store, twin, dt.date(2026, 9, 1), dt.date(2026, 9, 5))
    assert store.undo_manual_reading(a, ts=ts(m), raw_wh=1_060_250, epoch_lo=0, epoch_hi=None, tz=TZ) == "missing"


def test_open_gap_undo_before_the_meter_reports_again(env):
    db, store, _ = env
    a = add_meter(db)
    feed(store, a, [(local(2026, 9, 1), 500_000), (local(2026, 9, 1, 0, 15), 500_100)])
    before = buckets(store, a, local(2026, 9, 1), local(2026, 9, 3))
    m = local(2026, 9, 2, 6)
    assert plan(store, a, m, 520_100).effect == "allocation"
    assert store.undo_manual_reading(a, ts=ts(m), raw_wh=520_100, epoch_lo=0, epoch_hi=None, tz=TZ) is None
    assert buckets(store, a, local(2026, 9, 1), local(2026, 9, 3)) == before
    info = store.cursor_info([a])[a]
    assert (info.last_ts, info.last_value_wh) == (ts(local(2026, 9, 1, 0, 15)), 500_100)


def test_closed_gap_is_resplit_with_the_same_total_and_undo_is_exact(env):
    db, store, _ = env
    a, twin = add_meter(db, "א"), add_meter(db, "תאום")
    pts = [(local(2026, 9, 1), 1_000_000), (local(2026, 9, 1, 0, 10), 1_000_100), (local(2026, 9, 5), 1_100_100)]
    feed(store, a, pts)
    feed(store, twin, pts)
    m = local(2026, 9, 2)
    p = plan(store, a, m, 1_090_100)
    assert (p.effect, p.reason) == ("allocation", "closed_gap")
    assert raw_wh(store, a, local(2026, 9, 1), m) == 90_100  # whole quarter hours: the first 10 minutes' 100 Wh + 90 kWh
    assert raw_wh(store, a, m, local(2026, 9, 5)) == 10_000
    whole = (local(2026, 9, 1), local(2026, 9, 6))
    assert raw_wh(store, a, *whole) == raw_wh(store, twin, *whole) == 100_100
    assert sum(v[0] for v in daily(store, a, dt.date(2026, 9, 1), dt.date(2026, 9, 6)).values()) == 100_100
    assert daily(store, a, dt.date(2026, 9, 2), dt.date(2026, 9, 3))[dt.date(2026, 9, 2)][0] == 3_333  # 10 kWh over 3 days
    # a second reading inside the re-split gap re-splits its half; undoing the first then merges its two neighbours
    m2 = local(2026, 9, 3)
    assert plan(store, a, m2, 1_095_100).reason == "closed_gap"
    assert store.undo_manual_reading(a, ts=ts(m2), raw_wh=1_095_100, epoch_lo=0, epoch_hi=None, tz=TZ) is None
    assert store.undo_manual_reading(a, ts=ts(m), raw_wh=1_090_100, epoch_lo=0, epoch_hi=None, tz=TZ) is None
    assert buckets(store, a, *whole) == buckets(store, twin, *whole)
    assert daily(store, a, dt.date(2026, 9, 1), dt.date(2026, 9, 6)) == daily(store, twin, dt.date(2026, 9, 1), dt.date(2026, 9, 6))


def test_readings_that_cannot_change_the_series_are_recorded_only(env):
    db, store, _ = env
    a = add_meter(db)
    feed(store, a, [(local(2026, 9, 1, 10, k), 1_000_000 + k * 10) for k in range(0, 6)])  # reporting every minute
    feed(store, a, [(local(2026, 9, 3), 1_100_000), (local(2026, 9, 5), 50)])            # then a long gap and a reset
    before = buckets(store, a, local(2026, 9, 1), local(2026, 9, 6))
    cases = [
        (local(2026, 8, 30), 900_000, "no_counter_data"),     # before the first reading
        (local(2026, 9, 1, 10, 2), 1_000_020, "reported"),    # a reading at that exact instant
        (local(2026, 9, 1, 10, 2, ), 1_000_025, "reported"),
        (local(2026, 9, 2), 1_200_000, "outside_counter"),    # above the next counter reading
        (local(2026, 9, 4), 1_100_010, "counter_events"),     # the next reading is a reset
    ]
    for at, v, reason in cases:
        p = plan(store, a, at, v)
        assert (p.effect, p.reason) == ("record", reason), (at, v)
    assert plan(store, a, local(2026, 9, 2), 1_050_000, billed=ts(local(2026, 9, 2))).reason == "billed"  # energy before the billed end
    assert buckets(store, a, local(2026, 9, 1), local(2026, 9, 6)) == before
    b = add_meter(db, "ב")
    feed(store, b, [(local(2026, 9, 1), 0), (local(2026, 9, 1, 0, 15), 10)])
    assert plan(store, b, local(2026, 9, 1, 1), 100_000_000).reason == "implausible"  # 100 MWh in 45 minutes for a 100 kW meter
    assert plan(store, b, local(2026, 9, 1, 1), 5).reason == "outside_counter"         # an open gap below the counter
    assert plan(store, b, local(2026, 9, 1, 0, 30), 20).reason == "reported"           # 15 minutes after a report is no gap


# ---------------------------------------------------------------- calibration in the provider

def _calibrate(db, mid, day: dt.date, factor: str, offset_wh: int = 0) -> str:
    cid = new_id()
    with db.connection() as conn:
        epoch = conn.execute("SELECT id FROM energy_meter_epochs WHERE meter_id = ? AND ended_at IS NULL", (mid,)).fetchone()["id"]
        conn.execute("""INSERT INTO energy_meter_calibrations(id, meter_id, epoch_id, effective_date, effective_from, factor, offset_wh, created_at)
                        VALUES (?,?,?,?,?,?,?,?)""", (cid, mid, epoch, day.isoformat(), iso(dt.datetime(day.year, day.month, day.day, tzinfo=TZ)), factor, offset_wh,
                                                     "2026-09-01T00:00:00Z"))
    return cid


def test_calibration_applies_from_its_date_and_never_rewrites_history(env):
    db, store, settings = env
    mid = add_meter(db)
    feed(store, mid, [(local(2026, 9, d), 1_000_000 + (d - 1) * 10_000) for d in range(1, 12)])  # 10 kWh a day
    _calibrate(db, mid, dt.date(2026, 9, 6), "1.1", -100_500)
    with db.connection(mode="read") as conn:
        p = ep.EnergyProvider(conn, store, now=local(2026, 10, 1).timestamp())
        assert p.consumption(mid, local(2026, 9, 1), local(2026, 9, 6)).wh == 50_000            # before the date: as measured
        assert p.consumption(mid, local(2026, 9, 6), local(2026, 9, 11)).wh == 55_000           # from the date: x 1.1
        assert p.consumption(mid, local(2026, 9, 1), local(2026, 9, 11)).wh == 105_000
        assert raw_wh(store, mid, local(2026, 9, 6), local(2026, 9, 11)) == 50_000             # the stored series is untouched
        # contiguous windows (a time-of-use bill) add up exactly to the whole, rounded once on the cumulative line
        hours = [local(2026, 9, 5) + dt.timedelta(minutes=45 * k) for k in range(0, 65)]
        wins = list(zip(hours, hours[1:]))
        got = p.consumption_windows(mid, wins)
        assert sum(c.wh for c in got) == p.consumption(mid, hours[0], hours[-1]).wh == 21_000
        assert all(abs(c.wh - p.consumption(mid, c.start, c.end).wh) <= 1 for c in got)  # each window within 1 Wh of its own value
        # readings leave on the physical scale; the day before the date unchanged
        r = p.reading_at(mid, local(2026, 9, 8))
        assert r.value_wh == round(1.1 * 1_070_000) - 100_500 == 1_076_500 and r.exact
        assert p.reading_at(mid, local(2026, 9, 3)).value_wh == 1_020_000
        days = dict(p.daily(mid, dt.date(2026, 9, 4), dt.date(2026, 9, 8)))
        assert days[dt.date(2026, 9, 5)] == 10_000 and days[dt.date(2026, 9, 7)] == 11_000
        hist = p.history_windows([mid], dt.date(2026, 9, 6), dt.date(2026, 9, 8), "Asia/Jerusalem", count=1)[mid]
        assert hist.previous[0].wh == 20_000  # 9/4-9/6: before the calibration
        assert p.statuses([mid])[mid].last_value_wh == round(1.1 * 1_100_000) - 100_500
        assert [s.effective_date for s in p.calibrations(mid, local(2026, 9, 1), local(2026, 10, 1))] == ["2026-09-06"]
        assert p.calibrations(mid, local(2026, 9, 1), local(2026, 9, 6)) == []


def test_a_replacement_ends_the_calibration(env):
    db, store, _ = env
    mid = add_meter(db)
    feed(store, mid, [(local(2026, 9, 1), 1_000_000), (local(2026, 9, 2), 1_010_000)])
    _calibrate(db, mid, dt.date(2026, 9, 1), "1.5")
    at = local(2026, 9, 2, 12)
    with db.connection() as conn:
        conn.execute("UPDATE energy_meter_epochs SET ended_at = ? WHERE meter_id = ?", (iso(at), mid))
        conn.execute("INSERT INTO energy_meter_epochs(id, meter_id, started_at, start_reading_wh, reason, source_ref, created_at) VALUES (?,?,?,?,?,?,?)",
                     (new_id(), mid, iso(at), 0, "replaced", "sensor.x", iso(at)))
    store.start_epoch(mid, at=ts(at), epoch_id="e2", tz=TZ, start_wh=0)
    feed(store, mid, [(local(2026, 9, 3), 8_000)])
    with db.connection(mode="read") as conn:
        p = ep.EnergyProvider(conn, store, now=local(2026, 10, 1).timestamp())
        assert p.consumption(mid, local(2026, 9, 1), local(2026, 9, 2)).wh == 15_000   # old counter, calibrated
        assert p.consumption(mid, at, local(2026, 9, 3)).wh == 8_000                    # the new counter starts uncalibrated
        assert p.reading_at(mid, local(2026, 9, 3)).value_wh == 8_000


def test_the_bill_window_reaches_the_period_end_through_a_manual_reading(env):
    db, store, _ = env
    mid = add_meter(db)
    feed(store, mid, [(local(2026, 9, 1), 1_000_000), (local(2026, 9, 16), 1_388_100)])  # then silent
    bounds = [local(2026, 9, 1).astimezone(UTC), local(2026, 10, 1).astimezone(UTC)]
    with db.connection(mode="read") as conn:
        w = meter_window(ep.EnergyProvider(conn, store, now=local(2026, 10, 2).timestamp()), mid, bounds)
    assert w.wh == 388_100 and not w.reported_to_end and w.end.kind == "last_report"
    assert plan(store, mid, local(2026, 10, 1), 1_776_200).reason == "open_gap"
    with db.connection(mode="read") as conn:
        p = ep.EnergyProvider(conn, store, now=local(2026, 10, 2).timestamp())
        w = meter_window(p, mid, bounds)
        assert p.last_report_at(mid) == local(2026, 9, 16).astimezone(UTC) and p.data_until(mid) == local(2026, 10, 1).astimezone(UTC)
    assert w.wh == 776_200 and w.reported_to_end and w.end.reading_wh == 1_776_200 and w.end.kind == "reading"


# ---------------------------------------------------------------- the API

@pytest.fixture()
def app(settings):
    from smplwise.main import create_app

    c = TestClient(create_app(settings))
    assert c.get("/api/v1/me").status_code == 200  # joni: system_admin (bootstrap)
    db = Database(settings.db_path)
    store = st.store_for(settings)
    mid = add_meter(db, "לוח ראשי")
    feed(store, mid, [(local(2026, 9, 1), 1_000_000), (local(2026, 9, 1, 0, 15), 1_000_250)])
    return c, settings, db, store, mid


def audit_rows(settings, action: str):
    with Database(settings.db_path).connection(mode="read") as conn:
        return conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY at", (action,)).fetchall()


def post_reading(c, mid, at, value, unit="kWh", **kw):
    return c.post(f"{API}/meters/{mid}/manual-readings", json={"read_at": iso(at), "value": value, "unit": unit, **kw})


def test_manual_reading_validation_dry_run_audit_and_undo(app):
    c, settings, db, store, mid = app
    url = f"{API}/meters/{mid}/manual-readings"
    m = local(2026, 9, 3, 12)
    r = post_reading(c, mid, m, 1060.25, dry_run=True)
    assert r.status_code == 200, r.text
    dry = r.json()["reading"]
    assert r.json()["dry_run"] and dry["effect"] == "allocation" and dry["effect_reason"] == "open_gap" and dry["id"] is None and dry["message"]
    assert c.get(url).json()["items"] == [] and raw_wh(store, mid, local(2026, 9, 1, 0, 15), m) is None
    # refused input
    future = dt.datetime.now(UTC) + dt.timedelta(hours=1)
    for at, value, unit, code in ((future, 5, "kWh", "validation"), (local(2019, 1, 1), 5, "kWh", "validation"), (m, -1, "kWh", "validation"),
                                  (m, "abc", "kWh", "validation"), (m, 5, "W", "validation"), (m, 10**13, "kWh", "validation")):
        r = post_reading(c, mid, at, value, unit)
        assert r.status_code == 422 and r.json()["code"] == code, (at, value, unit, r.text)
    # the reading in Wh: stored as Wh, applied to the open gap, with who and when
    r = post_reading(c, mid, m, "1060250", "Wh", note="קריאה בלוח")
    assert r.status_code == 200, r.text
    got = r.json()["reading"]
    assert (got["value_kwh"], got["typed_value"], got["typed_unit"], got["effect"]) == (1060.25, "1060250", "Wh", "allocation")
    assert got["created_by_name"] and got["can_undo"] and got["note"] == "קריאה בלוח"
    assert raw_wh(store, mid, local(2026, 9, 1, 0, 15), m) == 60_000
    log = c.get(url).json()
    assert [i["id"] for i in log["items"]] == [got["id"]] and log["undo_window_hours"] == 24 and log["calibration"]["identity"] is True
    # monotonic among the manual readings of the counter; one reading per instant
    r = post_reading(c, mid, local(2026, 9, 2), 1070)
    assert r.status_code == 422 and r.json()["code"] == "reading_not_monotonic" and r.json()["details"]["neighbour"]["value_kwh"] == 1060.25
    r = post_reading(c, mid, local(2026, 9, 5), 1050)
    assert r.status_code == 422 and r.json()["code"] == "reading_not_monotonic"
    assert post_reading(c, mid, m, 1060.25).status_code == 409
    rows = audit_rows(settings, "energy.meter.manual_reading")
    assert [x["decision"] for x in rows].count("allowed") == 1 and any(x["decision"] == "refused" for x in rows)
    allowed = next(x for x in rows if x["decision"] == "allowed")
    assert json.loads(allowed["details_json"])["effect"] == "allocation" and allowed["actor_username"] == "joni"
    # undo: the series goes back, the reading stays listed as undone
    r = c.post(f"{url}/{got['id']}/undo", json={"reason": "הקלדה שגויה"})
    assert r.status_code == 200, r.text
    item = r.json()["items"][0]
    assert item["voided_at"] and item["voided_by_name"] and item["void_reason"] == "הקלדה שגויה" and not item["can_undo"]
    assert raw_wh(store, mid, local(2026, 9, 1, 0, 15), m) is None
    assert c.post(f"{url}/{got['id']}/undo", json={}).json()["code"] == "already_undone"
    assert [x["decision"] for x in audit_rows(settings, "energy.meter.manual_reading.undo")] == ["allowed", "refused"]
    # a voided reading no longer blocks the same instant
    assert post_reading(c, mid, m, 1060.25).status_code == 200


def test_undo_window_and_the_billed_guard(app, monkeypatch):
    c, settings, db, store, mid = app
    url = f"{API}/meters/{mid}/manual-readings"
    first = post_reading(c, mid, local(2026, 9, 3), 1060.25).json()["reading"]
    monkeypatch.setattr(ecal, "UNDO_WINDOW_S", -1)
    r = c.post(f"{url}/{first['id']}/undo", json={})
    assert r.status_code == 409 and r.json()["code"] == "undo_window_passed"
    assert c.get(url).json()["items"][0]["can_undo"] is False
    monkeypatch.setattr(ecal, "UNDO_WINDOW_S", 24 * 3600)
    _issue_bill(db, mid, local(2026, 9, 1), local(2026, 9, 2))  # an issued bill whose window ends after the reading's span starts
    r = c.post(f"{url}/{first['id']}/undo", json={})
    assert r.status_code == 409 and r.json()["code"] == "reading_billed"
    log = c.get(url).json()
    assert log["billed_until"] == iso(local(2026, 9, 2)) and log["first_calibration_date"] == "2026-09-02"


def _issue_bill(db, mid, start: dt.datetime, end: dt.datetime) -> None:
    from energy_fake import seed_account

    with db.connection() as conn:
        aid = "acc-" + uuid.uuid4().hex[:6]
        seed_account(conn, aid, "חשבון " + aid, [mid])
        snap = {"period": {"start_utc": iso(start), "end_utc": iso(end)}, "meters": [{"meter_id": mid}]}
        cust = conn.execute("SELECT customer_id FROM energy_accounts WHERE id = ?", (aid,)).fetchone()[0]
        conn.execute("""INSERT INTO energy_bills(id, account_id, customer_id, period_start, period_end, state, snapshot_json, created_at, updated_at)
                        VALUES (?,?,?,?,?,'issued',?,?,?)""", (new_id(), aid, cust, start.date().isoformat(), end.date().isoformat(), json.dumps(snap),
                                                               "2026-10-01T00:00:00Z", "2026-10-01T00:00:00Z"))


def test_calibration_api_rules_anchor_and_undo(app):
    c, settings, db, store, mid = app
    feed(store, mid, [(local(2026, 9, 2), 1_010_000), (local(2026, 9, 2, 0, 5), 1_010_050)])
    curl = f"{API}/meters/{mid}/calibrations"
    for factor in ("3", "0.4", "1.0000001", "x"):
        r = c.post(curl, json={"effective_date": "2026-09-10", "factor": factor})
        assert r.status_code == 422, factor
    r = c.post(curl, json={"effective_date": "2019-12-31", "factor": "1"})
    assert r.status_code == 422 and r.json()["code"] == "calibration_before_counter"
    assert c.post(curl, json={"effective_date": "2028-01-01", "factor": "1"}).status_code == 422
    # a reading compared with a measured counter value: recorded only, 5 kWh above the system
    reading = post_reading(c, mid, local(2026, 9, 2, 0, 5), 1015.05).json()["reading"]
    assert (reading["effect"], reading["effect_reason"], reading["deviation_kwh"], reading["system_exact"]) == ("record", "reported", 5.0, True)
    r = c.post(curl, json={"effective_date": "2026-09-02", "factor": "1", "anchor_reading_id": reading["id"], "dry_run": True})
    assert r.status_code == 200 and r.json()["calibration"]["offset_kwh"] == 5.0 and c.get(f"{API}/meters/{mid}").json()["calibration"] is None
    r = c.post(curl, json={"effective_date": "2026-09-02", "factor": "1", "anchor_reading_id": reading["id"], "note": "לפי המונה בלוח"})
    assert r.status_code == 200, r.text
    cal = r.json()["calibration"]
    assert cal["factor"] == "1.0" and cal["offset_kwh"] == 5.0 and cal["created_by_name"]
    meter = c.get(f"{API}/meters/{mid}").json()
    assert meter["calibration"] == {"factor": "1.0", "offset_kwh": 5.0, "effective_date": "2026-09-02"} and meter["value_kwh"] == 1015.05
    log = c.get(f"{API}/meters/{mid}/manual-readings").json()
    assert log["calibration"]["calibration_id"] == cal["id"] and log["calibrations"][0]["in_force"] is True
    # each calibration starts after the last one; the anchor reading cannot be undone while the calibration stands
    r = c.post(curl, json={"effective_date": "2026-09-02", "factor": "1.01"})
    assert r.status_code == 409 and r.json()["code"] == "calibration_not_after_last"
    r = c.post(f"{API}/meters/{mid}/manual-readings/{reading['id']}/undo", json={})
    assert r.status_code == 409 and r.json()["code"] == "reading_anchors_calibration"
    decisions = [x["decision"] for x in audit_rows(settings, "energy.meter.calibrate")]
    assert decisions.count("allowed") == 1 and decisions[-1] == "refused" and len(decisions) == 8  # 6 refused inputs, the save, the 409; dry runs are not audited
    # undo the calibration: the meter is back on the counter's own scale
    r = c.post(f"{curl}/{cal['id']}/undo", json={})
    assert r.status_code == 200 and r.json()["calibrations"][0]["voided_at"]
    assert c.get(f"{API}/meters/{mid}").json()["value_kwh"] == 1010.05
    # a calibration never starts inside an issued bill
    _issue_bill(db, mid, local(2026, 9, 1), local(2026, 9, 20))
    r = c.post(curl, json={"effective_date": "2026-09-10", "factor": "1.02"})
    assert r.status_code == 409 and r.json()["code"] == "calibration_billed" and r.json()["details"]["first_date"] == "2026-09-20"
    assert c.post(curl, json={"effective_date": "2026-09-20", "factor": "1.02"}).status_code == 200


def test_suggested_factor_from_two_compared_readings(app):
    c, settings, db, store, mid = app
    feed(store, mid, [(local(2026, 9, 2), 1_010_000), (local(2026, 9, 2, 0, 5), 1_010_050), (local(2026, 9, 6), 1_110_050), (local(2026, 9, 6, 0, 5), 1_110_100)])
    assert post_reading(c, mid, local(2026, 9, 2, 0, 5), 1010.05).json()["reading"]["effect"] == "record"
    assert post_reading(c, mid, local(2026, 9, 6, 0, 5), 1112.10).json()["reading"]["effect"] == "record"
    s = c.get(f"{API}/meters/{mid}/manual-readings").json()["suggestion"]
    assert s["factor"] == "1.02"  # 102.05 kWh on the meter for 100.05 kWh counted


def test_permissions_view_reads_manage_writes_403_before_body(app):
    c, settings, db, store, mid = app
    bind(c, settings, "omer", "operator", "installation", "*")
    bind(c, settings, "dana", "viewer", "installation", "*")
    o, v = as_user("omer"), as_user("dana")
    assert c.get(f"{API}/meters/{mid}/manual-readings", headers=o).status_code == 200
    assert c.get(f"{API}/meters/{mid}/manual-readings", headers=v).status_code == 403
    before = len(audit_rows(settings, "energy.manage"))
    for path in ("manual-readings", "calibrations", "manual-readings/x/undo", "calibrations/x/undo"):
        r = c.post(f"{API}/meters/{mid}/{path}", headers={**o, "content-type": "text/plain"}, content=b"{{{")
        assert r.status_code == 403, path
    assert len(audit_rows(settings, "energy.manage")) == before + 4
    r = c.post(f"{API}/meters/{mid}/manual-readings", content=b"x", headers={"content-type": "text/plain"})
    assert r.status_code == 415


def test_replace_takes_the_final_reading_on_the_physical_scale(app):
    c, settings, db, store, mid = app
    feed(store, mid, [(local(2026, 9, 2), 1_010_000)])
    _calibrate(db, mid, dt.date(2026, 9, 2), "1", 5_000)  # the physical meter shows 5 kWh more
    m = c.get(f"{API}/meters/{mid}").json()
    r = c.post(f"{API}/meters/{mid}/replace", json={"revision": m["revision"], "at": iso(local(2026, 9, 2, 6)), "old_final_reading_kwh": 1017.0,
                                                    "new_start_reading_kwh": 0})
    assert r.status_code == 200, r.text
    assert r.json()["epochs"][0]["end_reading_kwh"] == 1017.0  # the epoch keeps what was typed
    with db.connection(mode="read") as conn:
        p = ep.EnergyProvider(conn, store, now=local(2026, 10, 1).timestamp())
        assert p.consumption(mid, local(2026, 9, 2), local(2026, 9, 2, 6)).wh == 2_000  # 1017 physical = 1012 counter: 2 kWh after 1010


# ---------------------------------------------------------------- billing and the PDF

from test_energy_integration import _draft, rid, world  # noqa: E402,F401  (the real-store billing world)


def test_bill_and_pdf_use_the_calibration_consistently(world):
    from smplwise.services import bill_pdf_model

    c, settings, db, store, mid, acc = world
    # from 16.9 the physical meter runs 10% ahead; the offset keeps the reading continuous at that midnight (1388.1 kWh)
    r = c.post(f"{API}/meters/{mid}/calibrations", json={"effective_date": "2026-09-16", "factor": "1.1", "offset_kwh": -138.81})
    assert r.status_code == 200, r.text
    b = _draft(c, acc["id"])
    assert b["kwh"] == "815.01"  # 388.10 + 1.1 x 388.10
    meter = b["snapshot"]["meters"][0]
    assert meter["start"]["reading_kwh"] == "1000.000" and meter["end"]["reading_kwh"] == "1815.010"
    assert meter["consumption_kwh"] == "815.01" and meter["calibrations"][0] == {"from": "2026-09-16", "factor": "1.1", "offset_kwh": "-138.810"}
    notes = [n for n in b["snapshot"]["notes"] if n["code"] == "meter_calibrated"]
    assert len(notes) == 1 and "16.09.2026" in notes[0]["text_he"] and "1.1" in notes[0]["text_he"]
    doc = bill_pdf_model.coerce_snapshot(b["snapshot"])
    assert doc.meters[0].end_reading == doc.meters[0].start_reading + doc.meters[0].consumption_kwh
    assert any("מכוילות" in n for n in doc.notes)
    # the account history row of September agrees with the bill
    rows = c.get(f"{API}/accounts/{acc['id']}/history").json()["periods"]
    assert rows[-1]["kwh"] == "815.01"
    # once issued, a calibration can no longer start inside that period
    issued = c.post(f"{API}/bills/{b['id']}/issue", json={"row_version": b["row_version"], "client_request_id": rid()})
    assert issued.status_code == 200, issued.text
    r = c.post(f"{API}/meters/{mid}/calibrations", json={"effective_date": "2026-09-20", "factor": "1.2"})
    assert r.status_code == 409 and r.json()["code"] == "calibration_billed"
    cal_id = c.get(f"{API}/meters/{mid}/manual-readings").json()["calibrations"][0]["id"]
    assert c.post(f"{API}/meters/{mid}/calibrations/{cal_id}/undo", json={}).json()["code"] == "calibration_billed"
