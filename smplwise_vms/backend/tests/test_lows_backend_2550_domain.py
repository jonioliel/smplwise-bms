"""LOWS-BACKEND-2550 - the low domain-module findings of the 2.52 deep review (docs/review/DEEP-REVIEW-2520-INDEX.md).

D-06  a VAT rate used only by numbered WATER bills is not deleted (the VAT table is shared with water billing).
D-07  the customer number is locked by numbered water bills too.
D-08  a failing automatic (account, period) backs off (6 h, doubled, at most a day) and is audited once per new failure or changed error,
      not every 6 hours for ever.
D-09  an open generator alert is closed when its sensor role is unmapped or its generator is removed (it stayed open for ever).
D-10  a news feed that never succeeded backs off for one TTL like any failing feed (it was fetched again on every board poll).
Fakes only: no infrastructure, no device, no network."""
from __future__ import annotations

import datetime as dt

import pytest
from generator_world import make_generator, set_state

from smplwise.db import Database
from smplwise.services import energy_billing as eb
from smplwise.services import generator_alerts as alerts
from smplwise.services import generator_core as core
from smplwise.services import generator_runtime as runtime
from smplwise.services.bill_ledger import failure_retry
from smplwise.services.notices import sources

# the water world (its `app` fixture: the water module on, the SHARED VAT at 18 %, a fixed clock) and the electricity world (`w`)
from test_water_billing_s3 import API as WAPI  # noqa: E402
from test_water_billing_s3 import account, bill, setup_billing  # noqa: E402
from test_water_billing_s3 import app as water  # noqa: E402,F401 - the fixture, renamed
from energy_billing_world import utc  # noqa: E402
from test_energy_billing_api import API as EAPI, _backdate, golden_readings, w  # noqa: E402,F401 - `w` is the fixture
from test_energy_billing_api import setup_billing as e_setup  # noqa: E402


def _issued_water_bill(c, settings) -> dict:
    ids = setup_billing(c, settings)
    acc = account(c, ids, "דירה 12", {"m": ids["apt"]})
    b = bill(c, acc["id"])
    r = c.post(f"{WAPI}/bills/{b['id']}/issue", json={"row_version": b["row_version"], "client_request_id": "issue-00001"})
    assert r.status_code == 200, r.text
    return {**ids, "bill": r.json()}


# ---------------------------------------------------------------- D-06

def test_d06_a_vat_rate_used_only_by_water_bills_is_not_deleted(water):  # noqa: F811
    c, settings = water
    _issued_water_bill(c, settings)
    [vat] = c.get("/api/v1/energy/vat-rates").json()["items"]
    r = c.delete(f"/api/v1/energy/vat-rates/{vat['id']}")
    assert r.status_code == 409 and r.json()["code"] == "tariff_in_use", r.text
    assert [v["id"] for v in c.get("/api/v1/energy/vat-rates").json()["items"]] == [vat["id"]]


def test_d06_an_unused_vat_rate_is_still_deleted(water):  # noqa: F811
    c, _settings = water
    extra = c.post("/api/v1/energy/vat-rates", json={"effective_from": "2030-01-01", "rate_percent": "19"})
    assert extra.status_code == 201, extra.text
    unused = [v for v in extra.json()["items"] if v["effective_from"] == "2030-01-01"][0]
    assert c.delete(f"/api/v1/energy/vat-rates/{unused['id']}").status_code == 204


# ---------------------------------------------------------------- D-07

def test_d07_numbered_water_bills_lock_the_customer_number(water):  # noqa: F811
    c, settings = water
    ids = _issued_water_bill(c, settings)
    cust = c.get(f"/api/v1/energy/customers/{ids['customer']['id']}").json()
    r = c.patch(f"/api/v1/energy/customers/{cust['id']}", json={"base_revision": cust["revision"], "customer_number": str(int(cust["customer_number"]) + 7)})
    assert r.status_code == 409 and r.json()["code"] == "customer_number_locked", r.text
    # other fields still change
    r = c.patch(f"/api/v1/energy/customers/{cust['id']}", json={"base_revision": cust["revision"], "name": "דני כהן-לוי"})
    assert r.status_code == 200, r.text


# ---------------------------------------------------------------- D-08

def test_d08_the_wait_doubles_up_to_a_day():
    six = dt.timedelta(hours=6)
    assert [failure_retry(six, n) for n in (1, 2, 3, 4, 9)] == [six, 2 * six, 4 * six, 4 * six, 4 * six]
    assert failure_retry(dt.timedelta(hours=30), 3) == dt.timedelta(hours=30)  # a longer configured wait is never shortened


def test_d08_a_permanent_failure_backs_off_and_is_audited_once(w):  # noqa: F811
    golden_readings(w)
    s = e_setup(w)
    aid = s["account"]["id"]
    _backdate(w, aid)
    with w.db.connection() as conn:
        conn.execute("DELETE FROM energy_vat_rates")  # a permanent error: vat_missing
    t = utc(2026, 10, 2, 9)
    waits = []
    for _ in range(4):
        assert eb.auto_generate(w.db, now=t).failed == 1
        with w.db.connection(mode="read") as conn:
            run = conn.execute("SELECT status, error_code, next_attempt_at FROM energy_auto_runs WHERE account_id = ?", (aid,)).fetchone()
        assert run["status"] == "failed" and run["error_code"] == "vat_missing"
        nxt = dt.datetime.fromisoformat(run["next_attempt_at"].replace("Z", "+00:00"))
        waits.append(nxt - t)
        assert eb.auto_generate(w.db, now=nxt - dt.timedelta(minutes=1)).failed == 0  # not before its time
        t = nxt + dt.timedelta(minutes=1)
    assert waits == [dt.timedelta(hours=6), dt.timedelta(hours=12), dt.timedelta(hours=24), dt.timedelta(hours=24)]
    with w.db.connection(mode="read") as conn:
        n = conn.execute("SELECT COUNT(*) FROM audit_log WHERE action LIKE '%bill.auto_failed'").fetchone()[0]
    assert n == 1, "one audit row for the failure, not one per attempt"
    # fixed: the next attempt makes the bill
    w.c.post(f"{EAPI}/vat-rates", json={"effective_from": "2025-01-01", "rate_percent": "18"})
    assert eb.auto_generate(w.db, now=t + dt.timedelta(days=1)).created == 1


# ---------------------------------------------------------------- D-09

T0 = dt.datetime(2026, 10, 5, 9, 0, tzinfo=dt.timezone.utc).timestamp()


@pytest.fixture()
def gen(settings):
    from fastapi.testclient import TestClient

    from smplwise.main import create_app
    from smplwise.services import ha_sync

    ha_sync.STATE.connected = False
    alerts.reset()
    runtime.reset()
    c = TestClient(create_app(settings))
    c.get("/api/v1/me")
    db = Database(settings.db_path)
    make_generator(db, "full", model="DSE7320")
    with db.connection() as conn:
        core.detect(conn)
        gid = conn.execute("SELECT id FROM generator_devices WHERE status <> 'removed'").fetchone()["id"]
    yield c, db, gid
    alerts.reset()
    runtime.reset()


def _evaluate(db, ts: float):
    with db.connection() as conn:
        return alerts.evaluate(conn, ts)


def _open(db, key: str | None = None):
    with db.connection(mode="read") as conn:
        if key is None:
            return conn.execute("SELECT * FROM generator_alerts WHERE cleared_at IS NULL").fetchall()
        return conn.execute("SELECT * FROM generator_alerts WHERE alert_key = ? AND cleared_at IS NULL", (key,)).fetchall()


def _low_battery(db) -> None:
    set_state(db, "sensor.gen_battery", "11.0")
    _evaluate(db, T0)
    _evaluate(db, T0 + 61)
    assert len(_open(db, "battery_low")) == 1


def test_d09_an_alert_whose_role_is_unmapped_is_closed(gen):
    _c, db, gid = gen
    _low_battery(db)
    with db.connection() as conn:
        conn.execute("DELETE FROM generator_roles WHERE device_id = ? AND role = 'battery_v'", (gid,))
    r = _evaluate(db, T0 + 120)
    assert r["cleared"] >= 1 and not _open(db, "battery_low")
    with db.connection(mode="read") as conn:
        states = [x[0] for x in conn.execute("SELECT state FROM notifications WHERE source LIKE 'generator.battery_low@%'")]
    assert states and all(s == "resolved" for s in states)


def test_d09_a_removed_generators_open_alerts_are_closed(gen):
    _c, db, gid = gen
    _low_battery(db)
    with db.connection() as conn:
        conn.execute("UPDATE generator_devices SET status = 'removed' WHERE id = ?", (gid,))
    r = _evaluate(db, T0 + 120)
    assert r["cleared"] >= 1 and not _open(db)
    assert _evaluate(db, T0 + 180) == {"raised": 0, "cleared": 0}


# ---------------------------------------------------------------- D-10

def test_d10_a_feed_that_never_succeeded_backs_off():
    calls: list[str] = []
    clock = [1_800_000_000.0]

    def fetch(url):
        calls.append(url)
        raise OSError("refused")

    cache = sources.NewsCache(fetch=fetch, clock=lambda: clock[0], background=False)
    url = "https://feeds.example.invalid/rss"
    assert cache.titles(url) == []
    assert cache.titles(url) == [] and cache.titles(url) == []
    assert len(calls) == 1, "one fetch per TTL, not one per board poll"
    clock[0] += sources.NEWS_TTL_S + 1
    assert cache.titles(url) == [] and len(calls) == 2
    assert cache.health(url) == {"last_ok_at": None, "last_error": "network"}
