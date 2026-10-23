"""CR-WATER78 slice 3 (section 16, mockup v4 approved 24.10): water accounts, water + sewage tariffs, bills and tenant chargeback on the
electricity billing engine's parts, with the SHARED billing settings (VAT, business details, payment terms, numbering, retention - never a
water copy), the shared customer card and the shared number ledger; the losses account (main minus the sub-meters); permissions (water.bills
default-off for operator / viewer, money hidden without it); the module switch; the retire guard; the alert snooze settings and routes.
Fake mirror states and store samples only; no infrastructure, no device."""
from __future__ import annotations

import datetime as dt
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise import db as dbmod
from smplwise.db import Database
from smplwise.services import energy_billing as eb
from smplwise.services import energy_store as st
from smplwise.services import ha_sync
from smplwise.services import water_alerts as wa
from smplwise.services import water_billing as wb
from smplwise.services import water_meters as wm
from smplwise.services import water_runtime as wr
from smplwise.services import water_sampler

API = "/api/v1/infra/water"
TZ = ZoneInfo("Asia/Jerusalem")
W = {"unit_of_measurement": "L", "device_class": "water", "state_class": "total_increasing"}
SENSORS = {f"sensor.water_{k}": (f"מים {k}", "1000", W) for k in ("main", "apt", "garden")}
NOW = dt.datetime(2026, 10, 23, 10, 0, tzinfo=dt.timezone.utc)
SEPT = {"from": "2026-09-01", "to": "2026-09-30"}


def local(month: int, day: int, h: int = 0) -> int:
    return int(dt.datetime(2026, month, day, h, tzinfo=TZ).timestamp())


@pytest.fixture()
def app(settings, monkeypatch):
    from smplwise.main import create_app

    water_sampler.SAMPLER.shutdown()
    wr.reset()
    wb.reset()
    monkeypatch.setattr(wb, "now_utc", lambda: NOW)
    monkeypatch.setattr(eb, "now_utc", lambda: NOW)
    wb.set_now(NOW.timestamp())
    c = TestClient(create_app(settings))
    c.get("/api/v1/me")  # joni becomes system_admin (bootstrap)
    db = Database(settings.db_path)
    with db.connection(durable=False) as conn:
        for eid, (name, state, attrs) in SENSORS.items():
            ha_sync.upsert_state(conn, {"entity_id": eid, "state": state, "attributes": {"friendly_name": name, **attrs}})
    assert c.put(f"{API}/settings", json={"water.enabled": True}).status_code == 200
    r = c.post("/api/v1/energy/vat-rates", json={"effective_from": "2025-01-01", "rate_percent": "18"})  # the SHARED VAT
    assert r.status_code == 201, r.text
    yield c, settings
    water_sampler.SAMPLER.shutdown()
    wr.reset()
    wb.reset()


def meter(c, ref: str, **kw) -> str:
    r = c.post(f"{API}/meters", json={"source_ref": ref, **kw})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def feed_hourly(settings, rates_lph: dict[str, int], start: int, end: int, base_ml: int = 1_000_000) -> None:
    """One reading per hour for every meter from `start` to `end` inclusive: meter m grows by rates_lph[m] litres each hour."""
    store = wm.store_for(settings)
    ts, k = start, 0
    while ts <= end:
        store.apply([st.Sample(mid, ts, base_ml + k * lph * 1000, 20000.0) for mid, lph in rates_lph.items()], TZ)
        ts += 3600
        k += 1


def setup_billing(c, settings, *, sewage: str = "5.10", mode: str | None = None):
    main, apt, garden = meter(c, "sensor.water_main"), meter(c, "sensor.water_apt", kind="sub"), meter(c, "sensor.water_garden", kind="irrigation")
    feed_hourly(settings, {main: 80, apt: 50, garden: 20}, local(9, 1), local(10, 1))
    cust = c.post(f"{API}/customers", json={"name": "דני כהן", "address": "דירה 12"})
    assert cust.status_code == 201, cust.text
    body = {"name": "מים וביוב - מגורים", "water_price": "10.20", "sewage_price": sewage, "effective_from": "2026-01-01"}
    if mode:
        body["price_mode"] = mode
    tar = c.post(f"{API}/tariffs", json=body)
    assert tar.status_code == 201, tar.text
    return {"main": main, "apt": apt, "garden": garden, "customer": cust.json(), "tariff": tar.json()}


def account(c, ids, name: str, ast: dict, **kw) -> dict:
    r = c.post(f"{API}/accounts", json={"name": name, "customer_id": ids["customer"]["id"], "tariff_id": ids["tariff"]["id"], "formula": {"ast": ast},
                                        "first_period_start": "2026-09-01", "auto_mode": "off", **kw})
    assert r.status_code == 201, r.text
    return r.json()


def bill(c, aid: str, rid: str = "req-000001") -> dict:
    r = c.post(f"{API}/accounts/{aid}/bills", json={"period": SEPT, "client_request_id": rid})
    assert r.status_code == 201, r.text
    return r.json()


# ---------------------------------------------------------------- migration 0154 (PROVISIONAL)

def test_migration_0154_is_provisional_and_creates_only_water_tables(app):
    _c, settings = app
    f = dbmod.MIGRATIONS_DIR / "0154_infra_water_billing.sql"
    text = f.read_text(encoding="utf-8")
    assert "PROVISIONAL" in text.splitlines()[0]
    created = {ln.split()[2] for ln in text.splitlines() if ln.startswith("CREATE TABLE")}
    assert created == {"water_tariffs", "water_tariff_versions", "water_accounts", "water_account_meters", "water_bills", "water_bill_events", "water_auto_runs"}
    assert "vat" not in " ".join(created) and "customer" not in " ".join(created), "VAT and customers are the shared electricity tables"
    with Database(settings.db_path).connection(mode="read") as conn:
        cols = {r[1] for r in conn.execute("PRAGMA table_info(water_alert_settings)")}
        assert {"snooze_minutes_json", "snooze_default_min", "snooze_max_min"} <= cols
        assert {"snoozed_until", "snoozed_by"} <= {r[1] for r in conn.execute("PRAGMA table_info(water_alert_events)")}


# ---------------------------------------------------------------- the bill: water + sewage per m3, the shared VAT

def test_bill_has_water_and_sewage_lines_then_the_shared_vat(app):
    c, settings = app
    ids = setup_billing(c, settings)
    acc = account(c, ids, "דירה 12", {"m": ids["apt"]})
    b = bill(c, acc["id"])
    snap = b["snapshot"]
    assert snap["schema"] == wb.SCHEMA and snap["doc"]["title_he"] == "חשבון צריכת מים ודרישת תשלום"
    assert b["m3"] == "36.000" and snap["totals"]["m3"] == "36.000"  # 50 L/h x 720 h
    [water, sewage] = snap["lines"]
    assert (water["component"], water["m3"], water["amount_ex_vat"], water["vat_rate_percent"], water["vat_amount"]) == ("water", "36.000", "367.20", "18", "66.10")
    assert (sewage["component"], sewage["amount_ex_vat"], sewage["vat_amount"], sewage["total"]) == ("sewage", "183.60", "33.05", "216.65")
    assert b["total"] == "649.95" == snap["totals"]["total"]
    m = snap["meters"][0]
    assert (m["start"]["reading_m3"], m["end"]["reading_m3"], m["consumption_m3"]) == ("1.000", "37.000", "36.000")
    # the SHARED settings document: the business details and payment terms come from the electricity billing settings
    assert c.put("/api/v1/energy/billing-settings", json={"business": {"name": "דירות הנחל"}, "payment_terms": {"mode": "net_days", "days": 30}}).status_code == 200
    r = c.post(f"{API}/bills/{b['id']}/recalculate", json={"row_version": b["row_version"]})
    assert r.status_code == 200, r.text
    assert r.json()["snapshot"]["business"]["name"] == "דירות הנחל" and r.json()["snapshot"]["bill"]["payment_terms"]["days"] == 30


def test_no_sewage_line_when_the_sewage_price_is_zero_and_inc_vat_prices(app):
    c, settings = app
    ids = setup_billing(c, settings, sewage="0", mode="inc_vat")
    acc = account(c, ids, "גינה", {"m": ids["garden"]})
    snap = bill(c, acc["id"])["snapshot"]
    [line] = snap["lines"]
    assert line["component"] == "water" and line["m3"] == "14.400" and line["total"] == "146.88"  # 14.4 x 10.20 including VAT
    assert Decimal(line["amount_ex_vat"]) + Decimal(line["vat_amount"]) == Decimal("146.88")
    assert snap["totals"]["price_mode_note_he"] == "המחיר נקבע כולל מע״מ"


def test_losses_account_is_the_main_meter_minus_every_sub_meter(app):
    c, settings = app
    ids = setup_billing(c, settings)
    r = c.post(f"{API}/formula/preset", json={"preset": "main_minus_subs", "main_meter_id": ids["main"], "meter_ids": [ids["main"], ids["apt"], ids["garden"]]})
    assert r.status_code == 200, r.text
    acc = account(c, ids, "הפרש כללי (אובדן ודליפות)", r.json()["ast"])
    assert set(acc["formula"]["meter_ids"]) == {ids["main"], ids["apt"], ids["garden"]}
    b = bill(c, acc["id"])
    assert b["m3"] == "7.200"  # (80 - 50 - 20) L/h x 720 h
    coef = {m["meter_id"]: m["coefficient"] for m in b["snapshot"]["meters"]}
    assert coef == {ids["main"]: "1", ids["apt"]: "-1", ids["garden"]: "-1"}


def test_missing_vat_or_price_refuses_with_a_clear_code(app):
    c, settings = app
    ids = setup_billing(c, settings)
    t2 = c.post(f"{API}/tariffs", json={"name": "מאוחר", "water_price": "9", "effective_from": "2026-09-15"}).json()
    acc = account(c, ids, "דירה 12", {"m": ids["apt"]}, tariff_id=t2["id"])
    r = c.post(f"{API}/accounts/{acc['id']}/bills", json={"period": SEPT, "client_request_id": "req-missing1"})
    assert r.status_code == 422 and r.json()["code"] == "tariff_missing"


# ---------------------------------------------------------------- lifecycle and the shared number ledger

def test_issue_numbers_in_the_shared_space_then_sent_paid_correct(app):
    c, settings = app
    ids = setup_billing(c, settings)
    acc = account(c, ids, "דירה 12", {"m": ids["apt"]})
    b = bill(c, acc["id"])
    r = c.post(f"{API}/bills/{b['id']}/issue", json={"row_version": b["row_version"], "client_request_id": "issue-00001"})
    assert r.status_code == 200, r.text
    issued = r.json()
    cn = ids["customer"]["customer_number"]
    assert issued["number"] == f"2026-09-{cn}" and issued["state"] == "issued" and issued["snapshot_sha256"]
    with Database(settings.db_path).connection(mode="read") as conn:
        led = conn.execute("SELECT bill_id FROM energy_bill_numbers WHERE number = ?", (issued["number"],)).fetchone()
        assert led and led[0] == b["id"], "the water number is in the SHARED ledger"
        # an electricity bill of the same customer and month takes the next sequence, never the same number
        fake = {"period_end": "2026-10-01", "revision": 1, "replaces_bill_id": None}
        assert eb.number_for(conn, fake, cn)[0] == f"2026-09-{cn}/2"
    again = c.post(f"{API}/bills/{b['id']}/issue", json={"row_version": b["row_version"], "client_request_id": "issue-00001"})
    assert again.status_code == 200 and again.json()["number"] == issued["number"], "a double click returns the same bill"
    s = c.post(f"{API}/bills/{b['id']}/sent", json={"how": "email"})
    assert s.status_code == 200 and s.json()["state"] == "sent"
    p = c.post(f"{API}/bills/{b['id']}/paid", json={"reference": "העברה 1"})
    assert p.status_code == 200 and p.json()["state"] == "paid"
    corr = c.post(f"{API}/bills/{b['id']}/correct", json={"client_request_id": "correct-0001"})
    assert corr.status_code == 201, corr.text
    d = corr.json()
    assert d["revision"] == 2 and d["replaces_bill_id"] == b["id"]
    r2 = c.post(f"{API}/bills/{d['id']}/issue", json={"row_version": d["row_version"], "client_request_id": "issue-00002"})
    assert r2.status_code == 200 and r2.json()["number"] == f"2026-09-{cn}-2"
    orig = c.get(f"{API}/bills/{b['id']}").json()
    assert orig["state"] == "void" and orig["replaced_by_bill_id"] == d["id"]
    lst = c.get(f"{API}/bills").json()
    assert lst["counts"]["void"] == 1 and lst["counts"]["issued"] == 1 and lst["sums"]["open"] == "649.95"


def test_overlap_draft_exists_and_void_needs_a_reason(app):
    c, settings = app
    ids = setup_billing(c, settings)
    acc = account(c, ids, "דירה 12", {"m": ids["apt"]})
    b = bill(c, acc["id"])
    dup = c.post(f"{API}/accounts/{acc['id']}/bills", json={"period": SEPT, "client_request_id": "req-dup-0001"})
    assert dup.status_code == 409 and dup.json()["code"] == "draft_exists"
    c.post(f"{API}/bills/{b['id']}/issue", json={"row_version": b["row_version"], "client_request_id": "issue-00001"})
    ov = c.post(f"{API}/accounts/{acc['id']}/bills", json={"period": SEPT, "client_request_id": "req-ov-00001"})
    assert ov.status_code == 409 and ov.json()["code"] == "period_overlap"
    v = c.post(f"{API}/bills/{b['id']}/void", json={"reason": " "})
    assert v.status_code == 422 and v.json()["code"] == "reason_required"
    assert c.post(f"{API}/bills/{b['id']}/void", json={"reason": "קריאה שגויה"}).json()["state"] == "void"


def test_a_price_version_used_by_an_issued_bill_is_locked(app):
    c, settings = app
    ids = setup_billing(c, settings)
    acc = account(c, ids, "דירה 12", {"m": ids["apt"]})
    b = bill(c, acc["id"])
    tid, vid = ids["tariff"]["id"], ids["tariff"]["versions"][0]["id"]
    fix = c.patch(f"{API}/tariffs/{tid}/versions/{vid}", json={"effective_from": "2026-01-01", "water_price": "11", "sewage_price": "5.10"})
    assert fix.status_code == 200 and fix.json()["drafts"]["recomputed"] == 1, "an unused version is corrected; the draft follows"
    b = c.get(f"{API}/bills/{b['id']}").json()
    assert b["snapshot"]["lines"][0]["amount_ex_vat"] == "396.00"
    c.post(f"{API}/bills/{b['id']}/issue", json={"row_version": b["row_version"], "client_request_id": "issue-00001"})
    locked = c.patch(f"{API}/tariffs/{tid}/versions/{vid}", json={"effective_from": "2026-01-01", "water_price": "12", "sewage_price": "5.10"})
    assert locked.status_code == 409 and locked.json()["code"] == "tariff_period_sealed"
    assert c.get(f"{API}/tariffs").json()["items"][0]["versions"][0]["locked"] is True
    zero = c.post(f"{API}/tariffs", json={"name": "x", "water_price": "0", "effective_from": "2026-01-01"})
    assert zero.status_code == 422, "a water price must be > 0 (sewage may be 0)"


# ---------------------------------------------------------------- shared customer card

def test_customer_is_shared_and_not_deleted_while_a_water_account_exists(app):
    c, settings = app
    ids = setup_billing(c, settings)
    cust = ids["customer"]
    elec = c.get("/api/v1/energy/customers").json()["items"]
    assert [x["id"] for x in elec] == [cust["id"]], "one tenant card for electricity and water"
    acc = account(c, ids, "דירה 12", {"m": ids["apt"]})
    for url in (f"{API}/customers/{cust['id']}", f"/api/v1/energy/customers/{cust['id']}"):
        r = c.delete(url, params={"base_revision": cust["revision"]})
        assert r.status_code == 409 and r.json()["code"] == "customer_has_accounts", url
    one = c.get(f"{API}/customers/{cust['id']}").json()
    assert one["account_count"] == 1 and one["accounts"][0]["id"] == acc["id"] and one["open_balance"] == "0.00"


def test_a_meter_inside_an_account_formula_is_not_retired(app):
    c, settings = app
    ids = setup_billing(c, settings)
    account(c, ids, "דירה 12", {"m": ids["apt"]})
    rev = c.get(f"{API}/meters/{ids['apt']}").json()["revision"]
    r = c.delete(f"{API}/meters/{ids['apt']}", params={"revision": rev})
    assert r.status_code == 409 and r.json()["code"] == "meter_in_use"


# ---------------------------------------------------------------- permissions and the module switch

def test_water_bills_is_sensitive_and_only_for_the_admins():
    from smplwise.rbac import ROLES
    from smplwise.routers.access import PERMISSION_LABELS, SENSITIVE

    assert PERMISSION_LABELS["water.bills"] and "water.bills" in SENSITIVE
    assert [r for r in ("viewer", "operator", "site_admin", "system_admin") if "water.bills" in ROLES[r]] == ["site_admin", "system_admin"]


def test_operator_sees_accounts_without_money_and_no_bills(app):
    c, settings = app
    ids = setup_billing(c, settings)
    acc = account(c, ids, "דירה 12", {"m": ids["apt"]})
    bill(c, acc["id"])
    bind(c, settings, "omer", "operator", "installation", "*")
    bind(c, settings, "dana", "viewer", "installation", "*")
    bind(c, settings, "sara", "site_admin", "installation", "*")
    op = as_user("omer")
    lst = c.get(f"{API}/accounts", headers=op)
    assert lst.status_code == 200
    a = lst.json()["items"][0]
    assert "water_price" not in a["tariff"] and "total" not in (a["last_bill"] or {}) and lst.json()["summary"]["drafts"] is None
    st_ = c.get(f"{API}/accounts/{acc['id']}/status", headers=op).json()
    assert "amount_so_far" not in st_
    for url in (f"{API}/bills", f"{API}/tariffs", f"{API}/customers", f"{API}/billing/shared"):
        assert c.get(url, headers=op).status_code == 403, url
    assert c.get(f"{API}/accounts", headers=as_user("dana")).status_code == 403, "viewers have no water.view (owner Q4)"
    status = c.get(f"{API}/status", headers=op).json()
    assert status["can_bills"] is False and c.get(f"{API}/status", headers=as_user("sara")).json()["can_bills"] is True
    sara = c.get(f"{API}/bills", headers=as_user("sara"))
    assert sara.status_code == 200 and sara.json()["items"][0]["total"] == "649.95"


def test_module_off_answers_module_off_on_every_billing_route(app):
    c, settings = app
    assert c.put(f"{API}/settings", json={"water.enabled": False}).status_code == 200
    for url in (f"{API}/accounts", f"{API}/bills", f"{API}/tariffs", f"{API}/customers", f"{API}/billing/shared"):
        r = c.get(url)
        assert r.status_code == 404 and r.json()["code"] == "module_off", url


def test_shared_settings_read_reports_the_electricity_values(app):
    c, settings = app
    r = c.get(f"{API}/billing/shared")
    assert r.status_code == 200
    s = r.json()
    assert s["vat"]["current"]["rate_percent"] == "18" and s["payment_terms"]["mode"] == "net_days" and s["edit_link"] == "#/system/infra"
    assert s["retention"] == {"draft_days": 30, "bill_years": 7}


# ---------------------------------------------------------------- automatic generation

def test_auto_generation_makes_one_draft_per_period_and_is_idempotent(app):
    c, settings = app
    ids = setup_billing(c, settings)
    acc = account(c, ids, "דירה 12", {"m": ids["apt"]}, auto_mode="draft")
    with Database(settings.db_path).connection() as conn:
        conn.execute("UPDATE water_accounts SET created_at = '2026-08-20T00:00:00Z' WHERE id = ?", (acc["id"],))
    db = Database(settings.db_path)
    out = wb.auto_generate(db, settings, now=NOW)
    assert (out.created, out.failed) == (1, 0)
    assert wb.auto_generate(db, settings, now=NOW).created == 0
    [b] = c.get(f"{API}/bills").json()["items"]
    assert b["origin"] == "auto" and b["state"] == "draft" and b["m3"] == "36.000"


# ---------------------------------------------------------------- the alert snooze (section 16)

def _open_event(settings, mid: str) -> str:
    with Database(settings.db_path).connection() as conn:
        eid = dbmod.new_id()
        conn.execute("INSERT INTO water_alert_events(id, meter_id, kind, severity, opened_at, value_json) VALUES (?, ?, 'night_flow', 'warning', ?, '{}')",
                     (eid, mid, dbmod.now_iso()))
    return eid


def test_snooze_settings_validation_and_defaults(app):
    c, _settings = app
    g = c.get(f"{API}/alerts").json()
    assert g["snooze"] == {"durations": [15, 60, 240, 1440], "default": 60, "max": 10080}
    ok = c.put(f"{API}/alerts", json={"snooze": {"durations": [30, 120, 2880], "default": 120, "max": 4320}})
    assert ok.status_code == 200, ok.text
    assert ok.json()["snooze"] == {"durations": [30, 120, 2880], "default": 120, "max": 4320}
    bad_default = c.put(f"{API}/alerts", json={"snooze": {"durations": [30, 60], "default": 45}})
    assert bad_default.status_code == 422 and bad_default.json()["code"] == "snooze_default"
    over = c.put(f"{API}/alerts", json={"snooze": {"durations": [30, 9000], "default": 30, "max": 4320}})
    assert over.status_code == 422 and over.json()["code"] == "snooze_over_max"


def test_snooze_an_open_alert_for_the_default_and_a_listed_duration(app, monkeypatch):
    c, settings = app
    mid = meter(c, "sensor.water_main")
    eid = _open_event(settings, mid)
    t0 = 1_800_000_000
    monkeypatch.setattr(wr, "clock", lambda: t0)
    r = c.post(f"{API}/events/{eid}/snooze", json={})
    assert r.status_code == 200, r.text
    assert r.json()["snoozed_until"] == wm.epoch_to_iso(t0 + 3600) and r.json()["ack_at"] is None, "snoozed, not acknowledged"
    assert c.get(f"{API}/events/summary").json()["snoozed"] == 1
    assert c.post(f"{API}/events/{eid}/snooze", json={"minutes": 240}).json()["snoozed_until"] == wm.epoch_to_iso(t0 + 240 * 60)
    bad = c.post(f"{API}/events/{eid}/snooze", json={"minutes": 37})
    assert bad.status_code == 422 and bad.json()["code"] == "snooze_duration"
    bind(c, settings, "dana", "viewer", "installation", "*")
    assert c.post(f"{API}/events/{eid}/snooze", json={}, headers=as_user("dana")).status_code in (403, 404)
    assert c.delete(f"{API}/events/{eid}/snooze").json()["snoozed_until"] is None


def test_snooze_holds_warnings_like_a_mute_and_the_list_rules():
    rules = dict(wa.RULE_DEFAULTS)
    assert wr.holds(rules, quiet=False, muted=True) == ("mute", None), "a snooze holds warnings like a mute; an alarm goes out"
    assert wa.validate_snooze({"durations": [15, 60]}, dict(wa.SNOOZE_DEFAULTS))["durations"] == [15, 60]
    with pytest.raises(wa.AlertsInvalid):
        wa.validate_snooze({"durations": []}, dict(wa.SNOOZE_DEFAULTS))
    with pytest.raises(wa.AlertsInvalid):
        wa.validate_snooze({"max": 1}, dict(wa.SNOOZE_DEFAULTS))


def test_a_snoozed_night_flow_warning_is_held_then_returns_when_the_snooze_ends(app):
    c, settings = app
    mid = meter(c, "sensor.water_main")
    store = wm.store_for(settings)
    night = lambda h, m=0: int(dt.datetime(2026, 10, 20, h, m, tzinfo=TZ).timestamp())  # noqa: E731
    v = 1_000_000
    store.apply([st.Sample(mid, night(1), v, 20000.0)], TZ)
    for k in range(16):  # 1500 mL per 15 minutes = 6 L/h, the owner's threshold
        v += 1500
        store.apply([st.Sample(mid, night(1) + (k + 1) * 900, v, 20000.0)], TZ)
    db = Database(settings.db_path)
    assert wr.tick(db, settings, now=night(3, 2))["opened"] == 1
    with db.connection(mode="read") as conn:
        ev = conn.execute("SELECT * FROM water_alert_events WHERE meter_id = ?", (mid,)).fetchone()
    with db.connection() as conn:  # snoozed until 03:20, as the route does
        conn.execute("UPDATE water_alert_events SET snoozed_until = ? WHERE id = ?", (wm.epoch_to_iso(night(3, 20)), ev["id"]))
    wr.tick(db, settings, now=night(3, 17))
    with db.connection(mode="read") as conn:
        assert conn.execute("SELECT snoozed_until FROM water_alert_events WHERE id = ?", (ev["id"],)).fetchone()[0] is not None
    wr.tick(db, settings, now=night(3, 32))
    with db.connection(mode="read") as conn:
        row = conn.execute("SELECT snoozed_until, closed_at, ack_at, notification_id FROM water_alert_events WHERE id = ?", (ev["id"],)).fetchone()
    assert row["snoozed_until"] is None and row["closed_at"] is None and row["ack_at"] is None and row["notification_id"], "returned, still open, not acknowledged"