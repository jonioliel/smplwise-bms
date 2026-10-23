"""CR-WATER78 slice 1 (water meters, readings, consumption; owner decisions 2026-10-23): the module switch (default OFF, module_off on
every route but /status and /settings, the sampler thread only while on, audited), the permissions (viewer has NO water.view, operator
views, site_admin manages, floor scope narrows the meters, source_ref only to managers), the source validation matrix (a flow rate and a
gas meter refused with their own codes), litres / m3 conversion (gallon and cubic-foot factors exact in micro-litres), the counter rules
on litres through the water medium profile (and the electricity profile unchanged), series / consumption windows / CSV, manual
readings, retention, backup with and without history, and migration 0150 contiguity. Fake mirror states only; no
infrastructure, no device."""
from __future__ import annotations

import datetime as dt
import json
import time
import zipfile
from pathlib import Path

import pytest
from conftest import as_user, bind, seed_tree
from fastapi.testclient import TestClient

from smplwise import db as dbmod
from smplwise.db import Database
from smplwise.services import energy_counter as ec
from smplwise.services import energy_store as st
from smplwise.services import ha_scope, ha_sync
from smplwise.services import water_meters as wm
from smplwise.services import water_sampler

API = "/api/v1/infra/water"
UTC = dt.timezone.utc

W = {"unit_of_measurement": "m³", "device_class": "water", "state_class": "total_increasing"}
SENSORS = {
    "sensor.water_main": ("מים ראשי", "12.345", W),
    "sensor.water_f2": ("מים קומה 2", "100", {**W, "unit_of_measurement": "L"}),
    "sensor.water_f3": ("מים קומה 3", "200", {**W, "unit_of_measurement": "L"}),
    "sensor.water_gal": ("גלונים", "10", {**W, "unit_of_measurement": "gal"}),
    "sensor.water_ft3": ("רגל מעוקב", "10", {**W, "unit_of_measurement": "ft³"}),
    "sensor.water_flow": ("ספיקה", "4.2", {"unit_of_measurement": "L/min", "device_class": "volume_flow_rate", "state_class": "measurement"}),
    "sensor.water_flow_m3h": ("ספיקה שעתית", "0.3", {"unit_of_measurement": "m³/h"}),
    "sensor.gas_meter": ("מונה גז", "55.1", {"unit_of_measurement": "m³", "device_class": "gas", "state_class": "total_increasing"}),
    "sensor.water_pressure": ("לחץ", "3.1", {"unit_of_measurement": "bar", "device_class": "pressure"}),
    "sensor.water_ccf": ("CCF", "3", {"unit_of_measurement": "CCF", "device_class": "water"}),
    "sensor.water_noclass": ("ללא סוג", "1.5", {"unit_of_measurement": "m³"}),
    "sensor.water_total": ("מתאפס", "1.5", {**W, "state_class": "total", "last_reset": "2026-10-01T00:00:00+03:00"}),
    "sensor.water_down": ("לא מדווח", "unavailable", W),
    "sensor.water_measure": ("רגעי", "1.5", {**W, "state_class": "measurement"}),
    "sensor.water_neg": ("שלילי", "-1", W),
    "sensor.energy_kwh": ("חשמל", "10", {"unit_of_measurement": "kWh", "device_class": "energy", "state_class": "total_increasing"}),
}


def seed(settings, states=SENSORS):
    db = Database(settings.db_path)
    with db.connection(durable=False) as conn:
        for eid, (name, state, attrs) in states.items():
            ha_sync.upsert_state(conn, {"entity_id": eid, "state": state, "attributes": {"friendly_name": name, **attrs}})
    return db


def set_state(settings, eid: str, state: str, attrs: dict | None = None):
    name, _s, a = SENSORS[eid]
    seed(settings, {eid: (name, state, {**a, **(attrs or {})})})


def iso(ts: int) -> str:
    return dt.datetime.fromtimestamp(ts, UTC).isoformat().replace("+00:00", "Z")


def audit_rows(settings, action: str):
    with Database(settings.db_path).connection(mode="read") as conn:
        return conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY at", (action,)).fetchall()


@pytest.fixture()
def app(settings):
    from smplwise.main import create_app

    water_sampler.SAMPLER.shutdown()
    c = TestClient(create_app(settings))
    c.get("/api/v1/me")  # joni becomes system_admin (bootstrap)
    seed(settings)
    yield c, settings
    water_sampler.SAMPLER.shutdown()


def turn_on(c) -> None:
    r = c.put(f"{API}/settings", json={"water.enabled": True})
    assert r.status_code == 200, r.text


def create(c, ref, **kw):
    return c.post(f"{API}/meters", json={"source_ref": ref, **kw})


def tick(settings, at: int):
    return water_sampler.tick(Database(settings.db_path), settings, now=at, require_connection=False)


def t0() -> int:
    """A quarter-hour boundary 90 minutes ago (real clock: the routes measure 'reporting' against now)."""
    return int(time.time()) // 900 * 900 - 5400


# ---------------------------------------------------------------- module switch

def test_module_off_by_default_every_route_but_status_and_settings(app):
    c, settings = app
    s = c.get(f"{API}/status").json()
    assert s == {"enabled": False, "can_view": True, "can_manage": True, "can_configure": True, "meters": 0}
    for url in ("/meters", "/meters/x", "/candidates", "/consumption", "/consumption.csv", "/meters/x/series", "/meters/x/readings", "/meters/x/manual-readings"):
        r = c.get(API + url)
        assert r.status_code == 404 and r.json()["code"] == "module_off", url
        assert r.json()["details"]["message_en"]
    r = create(c, "sensor.water_main")
    assert r.status_code == 404 and r.json()["code"] == "module_off"
    # the settings section shows the switch only
    body = c.get(f"{API}/settings").json()
    assert body["values"] == {"water.enabled": False} and body["editable"] == {"water.enabled": True}
    assert tick(settings, t0())["skipped"] == "module_off"
    assert water_sampler.retention(Database(settings.db_path), settings)["skipped"] == "module_off"
    assert not (settings.data_dir / "water.db").exists()  # nothing created while off


def test_switch_needs_system_configure_is_audited_and_drives_the_sampler(app, monkeypatch):
    c, settings = app
    bind(c, settings, "sara", "site_admin", "installation", "*")
    r = c.put(f"{API}/settings", headers=as_user("sara"), json={"water.enabled": True})
    assert r.status_code == 403
    monkeypatch.setenv("SW_WATER_SAMPLER", "1")
    turn_on(c)
    assert water_sampler.SAMPLER.running, "turning the module on starts the sampler thread"
    row = audit_rows(settings, "infra.water.enabled")[-1]
    assert row["decision"] == "allowed" and json.loads(row["details_json"]) == {"enabled": True}
    assert c.get(f"{API}/status").json()["enabled"] is True
    assert c.get(f"{API}/meters").status_code == 200
    # site_admin edits the operational key (water.manage) but not the retention (system.configure)
    assert c.put(f"{API}/settings", headers=as_user("sara"), json={"water.stale_after_minutes": 60}).status_code == 200
    assert c.put(f"{API}/settings", headers=as_user("sara"), json={"water.raw_retention_days": 30}).status_code == 403
    # off again: the thread stops, the tables and the meters stay, the routes answer module_off
    m = create(c, "sensor.water_main")
    c.put(f"{API}/settings", json={"water.enabled": False})
    water_sampler.SAMPLER.thread.join(timeout=5)
    assert not water_sampler.SAMPLER.running
    assert json.loads(audit_rows(settings, "infra.water.enabled")[-1]["details_json"]) == {"enabled": False}
    assert c.get(f"{API}/meters").json()["code"] == "module_off"
    with Database(settings.db_path).connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM water_meters").fetchone()[0] == 1 and m.status_code == 201


def test_sampler_does_not_start_at_boot_while_off(settings, monkeypatch):
    monkeypatch.setenv("SW_WATER_SAMPLER", "1")
    water_sampler.SAMPLER.shutdown()
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    d = Database(settings.db_path)
    d.migrate()
    assert water_sampler.SAMPLER.start(d, settings) is False
    assert not water_sampler.SAMPLER.running


# ---------------------------------------------------------------- permissions

def test_permissions_registered_viewer_has_no_water_view():
    from smplwise.rbac import ROLES
    from smplwise.routers.access import PERMISSION_LABELS, SENSITIVE

    for p in ("water.view", "water.ack", "water.manage"):
        assert PERMISSION_LABELS[p] and p not in SENSITIVE
    assert {p for p in ROLES["operator"] if p.startswith("water.")} == {"water.view", "water.ack"}
    for role in ("site_admin", "system_admin"):
        assert {p for p in ROLES[role] if p.startswith("water.")} == {"water.view", "water.ack", "water.manage"}
    for role in ("viewer", "kiosk", "editor"):
        assert not [p for p in ROLES[role] if p.startswith("water.")], role  # owner Q4: viewers do NOT get water.view
    contract = json.loads((Path(__file__).resolve().parents[3] / "contracts" / "examples" / "role-catalog.design.json").read_text(encoding="utf-8"))
    for role in contract["roles"]:
        assert {p for p in role["permissions"] if p.startswith("water.")} == {p for p in ROLES[role["id"]] if p.startswith("water.")}, role["id"]


def test_viewer_denied_operator_views_without_entity_ids_manager_manages(app):
    c, settings = app
    turn_on(c)
    mid = create(c, "sensor.water_main").json()["id"]
    bind(c, settings, "dana", "viewer", "installation", "*")
    bind(c, settings, "omer", "operator", "installation", "*")
    v, o = as_user("dana"), as_user("omer")
    before = len(audit_rows(settings, "water.view"))
    assert c.get(f"{API}/meters", headers=v).status_code == 403
    assert c.get(f"{API}/meters/{mid}", headers=v).status_code == 403
    assert c.get(f"{API}/consumption", headers=v).status_code == 403
    assert len(audit_rows(settings, "water.view")) >= before + 3  # audited refusals
    assert c.get(f"{API}/status", headers=v).json()["can_view"] is False  # the gate never 403s
    items = c.get(f"{API}/meters", headers=o).json()["items"]
    assert [i["id"] for i in items] == [mid] and "source_ref" not in items[0]
    assert "source_ref" not in c.get(f"{API}/meters/{mid}", headers=o).json()
    assert c.get(f"{API}/meters").json()["items"][0]["source_ref"] == "sensor.water_main"  # water.manage sees the entity id
    # the operator manages nothing; the permission is checked before the body is read
    assert c.get(f"{API}/candidates", headers=o).status_code == 403
    assert c.post(f"{API}/meters", headers={**o, "content-type": "text/plain"}, content=b"{{{").status_code == 403
    assert c.patch(f"{API}/meters/{mid}", headers=o, json={"revision": 1, "display_name": "x"}).status_code == 403
    assert c.post(f"{API}/meters/{mid}/manual-readings", headers=o, json={"read_at": iso(t0()), "value": 1}).status_code == 403
    assert all(r["decision"] == "denied" for r in audit_rows(settings, "water.manage"))


def test_floor_scope_narrows_the_meters_with_a_uniform_404(app, monkeypatch):
    c, settings = app
    ids = seed_tree(c)
    turn_on(c)
    a = create(c, "sensor.water_f2").json()["id"]
    b = create(c, "sensor.water_f3").json()["id"]
    placed = {"sensor.water_f2": [{"floor_id": ids["floor2"], "floor_name": "קומה 2"}], "sensor.water_f3": [{"floor_id": ids["floor3"], "floor_name": "קומה 3"}]}
    monkeypatch.setattr(ha_scope, "placements", lambda conn: placed)
    bind(c, settings, "flo", "operator", "floor", ids["floor2"])
    f = as_user("flo")
    assert [i["id"] for i in c.get(f"{API}/meters", headers=f).json()["items"]] == [a]
    assert c.get(f"{API}/status", headers=f).json() == {"enabled": True, "can_view": True, "can_manage": False, "can_configure": False, "meters": 1}
    for url in (f"/meters/{b}", f"/meters/{b}/series", f"/meters/{b}/readings", "/meters/nope"):
        r = c.get(API + url, headers=f)
        assert r.status_code == 404 and r.json()["code"] == "not_found", url  # invisible = missing
    assert c.get(f"{API}/consumption", headers=f, params={"meter_ids": b}).status_code == 404
    got = c.get(f"{API}/consumption", headers=f).json()["items"]
    assert [i["meter_id"] for i in got] == [a]
    # an installation-wide operator sees both
    bind(c, settings, "omer", "operator", "installation", "*")
    assert len(c.get(f"{API}/meters", headers=as_user("omer")).json()["items"]) == 2


# ---------------------------------------------------------------- validation and units

def test_candidates_verdict_matrix_and_server_refusals(app):
    c, _ = app
    turn_on(c)
    by = {i["ref"]: i for i in c.get(f"{API}/candidates", params={"limit": 200}).json()["items"]}
    expect = {
        "sensor.water_main": ("ok", "ok"), "sensor.water_f2": ("ok", "ok"), "sensor.water_gal": ("ok", "ok"), "sensor.water_ft3": ("ok", "ok"),
        "sensor.water_flow": ("rejected", "flow_rate"), "sensor.water_flow_m3h": ("rejected", "flow_rate"), "sensor.gas_meter": ("rejected", "gas_later"),
        "sensor.water_pressure": ("rejected", "unit_rejected"), "sensor.water_ccf": ("rejected", "unit_rejected"),
        "sensor.water_noclass": ("warning", "warn_no_device_class"), "sensor.water_total": ("warning", "warn_total"),
        "sensor.water_down": ("warning", "warn_unavailable"), "sensor.water_measure": ("rejected", "measurement"),
        "sensor.water_neg": ("rejected", "state_negative"), "sensor.energy_kwh": ("rejected", "unit_rejected"),
    }
    for ref, (verdict, code) in expect.items():
        assert (by[ref]["verdict"], by[ref]["code"]) == (verdict, code), ref
    assert by["sensor.water_flow"]["message"].startswith("החיישן מודד ספיקה רגעית")
    assert "Home Assistant" not in json.dumps(by, ensure_ascii=False) and "attributes_json" not in by["sensor.water_main"]
    for ref, code in (("sensor.water_flow", "meter_flow_rate"), ("sensor.gas_meter", "meter_gas_later"), ("sensor.water_pressure", "meter_unit_rejected")):
        r = create(c, ref)
        assert r.status_code == 422 and r.json()["code"] == code and r.json()["details"]["message_en"], ref
    assert create(c, "sensor.water_main").status_code == 201
    r = create(c, "sensor.water_main")
    assert r.status_code == 409 and r.json()["code"] == "meter_duplicate"
    m = create(c, "sensor.water_gal").json()
    assert m["unit"] == "gal" and m["kind"] == "main" and m["max_flow_lph"] == 20000


def test_unit_conversion_litres_and_m3():
    assert wm.to_ml("12.345", wm.UNITS["m³"][1]) == 12_345_000
    assert wm.to_ml("250.5", wm.UNITS["l"][1]) == 250_500
    assert wm.to_ml("1000", wm.UNITS["gal"][1]) == 3_785_412  # 1 US gallon = 3.785412 L, exact in micro-litres
    assert wm.to_ml("1", wm.UNITS["ft³"][1]) == 28_317 and wm.to_ml("1000", wm.UNITS["ft3"][1]) == 28_316_847
    assert wm.to_ml("unavailable", 1_000_000) is None and wm.to_ml("-1", 1_000_000) is None and wm.to_ml("abc", 1_000_000) is None
    assert wm.typed_ml("1,5", "m3") == 1_500_000 and wm.typed_ml(40, "L") == 40_000
    assert wm.litres(12_345_678) == 12345.678
    # owner Q10: m3 with 3 decimals, litres below 1 m3
    assert wm.display(1_000_000) == {"value": 1.0, "unit": "m3"} and wm.display(12_345_678) == {"value": 12.346, "unit": "m3"}
    assert wm.display(250_500) == {"value": 250.5, "unit": "L"} and wm.display(0) == {"value": 0.0, "unit": "L"} and wm.display(None) is None


# ---------------------------------------------------------------- counter rules on litres (the medium profile)

def test_water_profile_noise_reset_cap_and_electricity_unchanged():
    p = wm.WATER_PROFILE
    base = ec.CounterState(last_ts=0, last_value_wh=1_000_000)  # 1000 L
    noise = ec.process(base, 60, 985_000, 20000, profile=p)  # a 15 L drop: noise for water
    assert noise.flags & ec.F_NOISE and not noise.accepted
    assert ec.process(base, 60, 985_000, 100).flags & ec.F_GLITCH  # the electricity profile would hold it (1000 Wh noise floor)
    reset = ec.process(base, 60, 15_000, 20000, profile=p)  # back to 15 L: a reset, the 15 L since it count
    assert reset.flags & ec.F_RESET and reset.spans[0].wh == 15_000
    # cap: 20 000 L/h for one minute x 1.5 + 20 L = 520 L
    assert ec.cap_wh(20000, 0, 60, p) == pytest.approx(520_000)
    spike = ec.process(base, 60, 1_000_000 + 5_000_000, 20000, profile=p)  # +5000 L in a minute: held
    assert spike.flags & ec.F_GLITCH and not spike.accepted
    back = ec.process(spike.state, 120, 1_000_200, 20000, profile=p)
    assert back.flags & ec.F_SPIKE_DROPPED and back.spans[0].wh == 200
    # electricity characterisation: the default profile carries the released constants
    assert ec.ENERGY == ec.CounterProfile(ec.RESET_ABS_WH, ec.NOISE_ABS_WH, ec.CAP_SLACK_WH) == ec.CounterProfile(1000, 1000, 50)
    assert ec.cap_wh(100, 0, 3600) == pytest.approx(150_050)


def test_energy_store_keeps_the_energy_profile_and_water_has_its_own_file(app):
    c, settings = app
    turn_on(c)
    assert st.store_for(settings).profile is ec.ENERGY
    ws_ = wm.store_for(settings)
    assert ws_.profile is wm.WATER_PROFILE and ws_.path.name == "water.db" and ws_.path != st.store_for(settings).path


# ---------------------------------------------------------------- readings, series, consumption windows

def _five_readings(c, settings):
    turn_on(c)
    m = create(c, "sensor.water_main").json()
    t = t0()
    with Database(settings.db_path).connection() as conn:  # the readings below are in the past: the counter life began before them
        conn.execute("UPDATE water_meter_epochs SET started_at = ? WHERE meter_id = ?", (iso(t - 3600), m["id"]))
    for k in range(5):
        set_state(settings, "sensor.water_main", f"{12.345 + k * 0.010:.3f}")
        assert tick(settings, t + k * 60)["samples"] == 1
    return m, t


def test_readings_series_and_consumption_in_litres(app):
    c, settings = app
    m, t = _five_readings(c, settings)
    r = c.get(f"{API}/meters/{m['id']}/readings", params={"from": iso(t), "to": iso(t + 3600)}).json()
    assert [i["litres"] for i in r["items"]] == [12345.0, 12355.0, 12365.0, 12375.0, 12385.0]
    meter = c.get(f"{API}/meters").json()["items"][0]
    assert meter["state"] == "reporting" and meter["value_l"] == 12385.0 and meter["value"] == {"value": 12.385, "unit": "m3"}
    assert meter["last_report_at"] == iso(t + 240)
    # a 15-minute window: the 40 L measured, partial coverage
    item = c.get(f"{API}/consumption", params={"meter_ids": m["id"], "from": iso(t), "to": iso(t + 900)}).json()["items"][0]
    assert item["litres"] == 40.0 and item["value"] == {"value": 40.0, "unit": "L"} and item["coverage"] == "partial" and item["share"] == 1.0
    assert item["previous_litres"] is None
    # consecutive windows add up to the whole (allocation by time on the cumulative line)
    halves = [c.get(f"{API}/consumption", params={"meter_ids": m["id"], "from": iso(a), "to": iso(b)}).json()["items"][0]["litres"]
              for a, b in ((t, t + 450), (t + 450, t + 900))]
    assert halves == [20.0, 20.0]
    series = c.get(f"{API}/meters/{m['id']}/series", params={"from": iso(t), "to": iso(t + 3600), "bucket": "15m"}).json()["items"]
    assert len(series) == 4 and series[0]["litres"] == 40.0 and series[1]["litres"] is None
    body = c.get(f"{API}/consumption", params={"from": iso(t), "to": iso(t + 3600), "bucket": "1h"}).json()
    assert body["total_litres"] == 40.0 and sum(x["litres"] or 0 for x in body["series"]) == 40.0
    day = c.get(f"{API}/consumption", params={"from": iso(t - 86400), "to": iso(t + 3600), "bucket": "1d"}).json()
    assert sum(x["litres"] or 0 for x in day["series"]) == 40.0
    # the previous range of the same length now has the data
    later = c.get(f"{API}/consumption", params={"meter_ids": m["id"], "from": iso(t + 900), "to": iso(t + 1800)}).json()["items"][0]
    assert later["previous_litres"] == 40.0 and later["litres"] is None
    assert c.get(f"{API}/consumption", params={"from": iso(t + 900), "to": iso(t)}).json()["code"] == "period_invalid"
    # the water store only: the electricity store got nothing
    assert st.store_for(settings).counts() == {"readings": 0, "intervals": 0, "daily": 0}


def test_consumption_csv_is_formula_safe_bom_and_audited(app):
    c, settings = app
    m, t = _five_readings(c, settings)
    c.patch(f"{API}/meters/{m['id']}", json={"revision": m["revision"], "display_name": "=HYPERLINK(1)"})
    r = c.get(f"{API}/consumption.csv", params={"from": iso(t), "to": iso(t + 900), "lang": "en"})
    assert r.status_code == 200 and r.text.startswith("﻿Meter,") and "'=HYPERLINK(1)" in r.text and ",40.0,0.040," in r.text
    assert c.get(f"{API}/consumption.csv", params={"from": iso(t), "to": iso(t + 900)}).text.startswith("﻿מונה,")
    assert audit_rows(settings, "infra.water.export")[-1]["decision"] == "allowed"


def test_unit_change_pauses_and_retired_meter_is_not_sampled(app):
    c, settings = app
    m, t = _five_readings(c, settings)
    set_state(settings, "sensor.water_main", "12400", {"unit_of_measurement": "L"})
    assert tick(settings, t + 600)["paused"] == [m["id"]]
    got = c.get(f"{API}/meters/{m['id']}").json()
    assert got["status"] == "paused" and got["status_reason"] == "unit_changed"
    assert audit_rows(settings, "infra.water.meter.pause")[-1]["resource_id"] == m["id"]


def test_manual_reading_closes_an_open_gap_and_undo(app):
    c, settings = app
    m, t = _five_readings(c, settings)
    at = t + 90 * 60  # 86 minutes after the last report: an open gap (and not in the future)
    dry = c.post(f"{API}/meters/{m['id']}/manual-readings", json={"read_at": iso(at), "value": "12.400", "unit": "m3", "dry_run": True}).json()
    assert dry == {"effect": "allocation", "reason": "open_gap", "litres": 12400.0, "dry_run": True}
    r = c.post(f"{API}/meters/{m['id']}/manual-readings", json={"read_at": iso(at), "value": "12.400", "unit": "m3"}).json()
    assert r["effect"] == "allocation" and r["id"]
    total = c.get(f"{API}/consumption", params={"meter_ids": m["id"], "from": iso(t), "to": iso(at)}).json()["items"][0]["litres"]
    assert total == 55.0  # 40 L reported + 15 L spread over the gap
    assert audit_rows(settings, "infra.water.reading.manual")[-1]["decision"] == "allowed"
    u = c.post(f"{API}/meters/{m['id']}/manual-readings/{r['id']}/undo", json={"reason": "typo"})
    assert u.status_code == 200 and u.json()["voided_at"]
    assert c.get(f"{API}/consumption", params={"meter_ids": m["id"], "from": iso(t), "to": iso(at)}).json()["items"][0]["litres"] == 40.0
    assert c.post(f"{API}/meters/{m['id']}/manual-readings/{r['id']}/undo", json={}).json()["code"] == "reading_voided"


def test_retention_prunes_the_water_store_only(app):
    c, settings = app
    m, t = _five_readings(c, settings)
    out = water_sampler.retention(Database(settings.db_path), settings, now=t + 100 * 86400)
    assert out["removed"]["readings"] == 5 and out["removed"]["daily"] == 0
    assert wm.store_for(settings).daily(m["id"], dt.date(2000, 1, 1), dt.date(2100, 1, 1))  # daily totals kept (7 years)


# ---------------------------------------------------------------- backup

def test_backup_daily_always_history_only_when_asked_and_restore_allow_list(app, tmp_path):
    from smplwise.config import Settings
    from smplwise.main import create_app
    from smplwise.services import backup

    c, settings = app
    m, t = _five_readings(c, settings)
    db = Database(settings.db_path)
    with db.connection() as conn:
        e1 = backup.create(settings, conn, note="t")
    with zipfile.ZipFile(backup.backups_dir(settings) / e1["name"]) as z:
        names = set(z.namelist())
        assert {"data/water_meters.json", "data/water_meter_epochs.json", "data/water_meter_manual_readings.json", "water/daily.json"} <= names
        assert "water/water.db" not in names  # owner default: history excluded
        daily = json.loads(z.read("water/daily.json"))
        assert [d["meter"] for d in daily] and sum(d["wh"] for d in daily) == 40_000
    assert c.put(f"{API}/settings", json={"water.include_history_in_backup": True}).status_code == 200
    with db.connection() as conn:
        e2 = backup.create(settings, conn, note="history")
    with zipfile.ZipFile(backup.backups_dir(settings) / e2["name"]) as z:
        assert "water/water.db" in z.namelist()
    other = Settings(**{**settings.__dict__, "data_dir": tmp_path / "other"})
    TestClient(create_app(other)).get("/api/v1/me")
    with Database(other.db_path).connection() as conn:
        res = backup.restore(other, conn, backup.backups_dir(settings) / e2["name"], mode="replace")
    assert res["water"]["history"]["readings"] == 5
    assert sum(v[0] for v in wm.store_for(other).daily(m["id"], dt.date(2000, 1, 1), dt.date(2100, 1, 1)).values()) == 40_000
    third = Settings(**{**settings.__dict__, "data_dir": tmp_path / "third"})
    TestClient(create_app(third)).get("/api/v1/me")
    with Database(third.db_path).connection() as conn:
        res = backup.restore(third, conn, backup.backups_dir(settings) / e1["name"], mode="replace")
    assert res["water"]["daily"] >= 1 and not res["water"]["history"]


def test_water_tables_are_project_tables_kept_when_absent():
    from smplwise.services import backup

    for t in ("water_meters", "water_meter_epochs", "water_meter_manual_readings"):
        assert t in backup.PROJECT_TABLES and t in backup.KEEP_WHEN_ABSENT


# ---------------------------------------------------------------- migration 0150 (built as provisional 0152; renumbered at release/2140)


def test_migration_numbers_contiguous():
    files = {int(f.name.split("_", 1)[0]): f for f in dbmod.MIGRATIONS_DIR.glob("*.sql")}
    numbers = sorted(files)
    assert numbers == list(range(1, numbers[-1] + 1)), "the sequence has no gap"
    water = [f.name for f in files.values() if "water" in f.name]
    assert water == ["0151_infra_water.sql"], "one file for the water module"
    text = files[150].read_text(encoding="utf-8")
    assert "Final number 0150" in text.splitlines()[0] and "CREATE TABLE water_meters" in text


def test_migration_applies_and_carries_the_gas_reservation(settings):
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    d = Database(settings.db_path)
    d.migrate()
    with d.connection() as conn:
        cols = {r[1] for r in conn.execute("PRAGMA table_info(water_meters)").fetchall()}
        assert {"medium", "unit_factor", "max_flow_lph", "kind", "rules_json"} <= cols
        now = "2026-10-23T00:00:00Z"
        conn.execute("INSERT INTO water_meters(id, medium, source_ref, display_name, unit, unit_factor, created_at, updated_at) VALUES ('g', 'gas', 's.g', 'g', 'm3', 1000000000, ?, ?)", (now, now))
        with pytest.raises(Exception):
            conn.execute("INSERT INTO water_meters(id, medium, source_ref, display_name, unit, unit_factor, created_at, updated_at) VALUES ('x', 'oil', 's.x', 'x', 'm3', 1000000000, ?, ?)", (now, now))
