"""CR-023 P1: the electricity meters API - the kWh/kW validation matrix (picker and server), the registry (create,
duplicate, rename, pause, retire, in use, replace), RBAC with the three permissions (403 + audit BEFORE the body is read),
the sampler fed from the state mirror (fake states only), unit change pauses the meter, series / readings / consumption,
settings with per-key permissions and the storage estimate, and backup / restore of the energy part. No infrastructure
or device is contacted."""
from __future__ import annotations

import datetime as dt
import json
import zipfile
from zoneinfo import ZoneInfo

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.db import Database
from smplwise.services import energy_sampler, energy_store as st, ha_sync

TZ = ZoneInfo("Asia/Jerusalem")
UTC = dt.timezone.utc
API = "/api/v1/energy"


def local(y, mo, d, h=0, mi=0) -> dt.datetime:
    return dt.datetime(y, mo, d, h, mi, tzinfo=TZ)


def iso(x: dt.datetime) -> str:
    return x.astimezone(UTC).isoformat().replace("+00:00", "Z")


SENSORS = {
    "sensor.main_energy": ("לוח ראשי אנרגיה", "12345.678", {"unit_of_measurement": "kWh", "device_class": "energy", "state_class": "total_increasing"}),
    "sensor.ac_energy_wh": ("מזגנים", "500000", {"unit_of_measurement": "Wh", "device_class": "energy", "state_class": "total_increasing"}),
    "sensor.site_mwh": ("אתר", "1.25", {"unit_of_measurement": "MWh", "device_class": "energy", "state_class": "total_increasing"}),
    "sensor.main_power": ("לוח ראשי הספק", "3200", {"unit_of_measurement": "W", "device_class": "power", "state_class": "measurement"}),
    "sensor.main_power_kw": ("הספק קילוואט", "3.2", {"unit_of_measurement": "kW", "device_class": "power"}),
    "sensor.odd_measure": ("מדידה רגעית", "4.0", {"unit_of_measurement": "kWh", "device_class": "energy", "state_class": "measurement"}),
    "sensor.daily_energy": ("צריכה יומית", "3.1", {"unit_of_measurement": "kWh", "device_class": "energy", "state_class": "total", "last_reset": "2026-10-04T00:00:00+03:00"}),
    "sensor.down_energy": ("מונה מנותק", "unavailable", {"unit_of_measurement": "kWh", "device_class": "energy", "state_class": "total_increasing"}),
    "sensor.text_energy": ("מונה טקסט", "error", {"unit_of_measurement": "kWh", "device_class": "energy"}),
    "sensor.neg_energy": ("מונה שלילי", "-4", {"unit_of_measurement": "kWh", "device_class": "energy"}),
    "sensor.grid_returned_energy": ("החזרה לרשת", "10", {"unit_of_measurement": "kWh", "device_class": "energy", "state_class": "total_increasing"}),
    "sensor.no_unit": ("ללא יחידה", "10", {"device_class": "energy"}),
    "sensor.gas_kwh": ("גז", "10", {"unit_of_measurement": "kWh", "device_class": "gas"}),
    "sensor.plain_kwh": ("ללא סוג", "10", {"unit_of_measurement": "kWh"}),
    "switch.boiler": ("דוד", "on", {}),
}


def seed(settings, states=SENSORS):
    db = Database(settings.db_path)
    with db.connection(durable=False) as conn:
        for eid, (name, state, attrs) in states.items():
            ha_sync.upsert_state(conn, {"entity_id": eid, "state": state, "attributes": {"friendly_name": name, **attrs}})
    return db


def set_state(settings, eid: str, state: str, attrs: dict | None = None):
    name, _s, a = SENSORS.get(eid, (eid, "", {}))
    seed(settings, {eid: (name, state, {**a, **(attrs or {})})})


@pytest.fixture()
def app(settings):
    from smplwise.main import create_app

    c = TestClient(create_app(settings))
    c.get("/api/v1/me")  # joni becomes system_admin (bootstrap)
    seed(settings)
    return c, settings


def audit_rows(settings, action: str):
    with Database(settings.db_path).connection(mode="read") as conn:
        return conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY at", (action,)).fetchall()


def create(c, ref, **kw):
    return c.post(f"{API}/meters", json={"source_ref": ref, **kw})


# ---------------------------------------------------------------- validation matrix

def test_candidates_verdict_matrix(app):
    c, _ = app
    r = c.get(f"{API}/candidates", params={"limit": 200})
    assert r.status_code == 200
    by = {i["ref"]: i for i in r.json()["items"]}
    expect = {
        "sensor.main_energy": ("ok", "ok"), "sensor.ac_energy_wh": ("ok", "ok"), "sensor.site_mwh": ("ok", "ok"),
        "sensor.main_power": ("rejected", "power_unit"), "sensor.main_power_kw": ("rejected", "power_unit"),
        "sensor.odd_measure": ("rejected", "measurement"), "sensor.daily_energy": ("warning", "warn_total"),
        "sensor.down_energy": ("warning", "warn_unavailable"), "sensor.text_energy": ("rejected", "state_not_numeric"),
        "sensor.neg_energy": ("rejected", "state_negative"), "sensor.grid_returned_energy": ("rejected", "returned_energy"),
        "sensor.no_unit": ("rejected", "unit_missing"), "sensor.gas_kwh": ("rejected", "device_class_rejected"),
        "sensor.plain_kwh": ("warning", "warn_no_device_class"),
    }
    for ref, (verdict, code) in expect.items():
        assert (by[ref]["verdict"], by[ref]["code"]) == (verdict, code), ref
    assert "switch.boiler" not in by  # sensors only
    assert by["sensor.main_power"]["message"].startswith("החיישן מודד הספק רגעי")
    assert "Home Assistant" not in json.dumps(r.json(), ensure_ascii=False)
    assert "attributes_json" not in by["sensor.main_energy"]
    # search by name; rejected hidden on request
    r = c.get(f"{API}/candidates", params={"q": "לוח ראשי", "include_rejected": "false"})
    assert [i["ref"] for i in r.json()["items"]] == ["sensor.main_energy"]


def test_server_repeats_validation_and_converts_units(app):
    c, _ = app
    r = create(c, "sensor.main_power")
    assert r.status_code == 422 and r.json()["code"] == "meter_unit_rejected" and r.json()["details"]["code"] == "power_unit"
    assert create(c, "switch.boiler").status_code == 422
    assert create(c, "sensor.unknown_energy").json()["details"]["code"] == "source_missing"
    ok = create(c, "sensor.ac_energy_wh", display_name="מזגנים קומה 1")
    assert ok.status_code == 201 and ok.json()["unit"] == "Wh" and ok.json()["display_name"] == "מזגנים קומה 1"
    assert ok.json()["epochs"][0]["reason"] == "first"
    dup = create(c, "sensor.ac_energy_wh")
    assert dup.status_code == 409 and dup.json()["code"] == "meter_duplicate"
    warn = create(c, "sensor.daily_energy")
    assert warn.status_code == 201 and warn.json()["warning"]
    assert audit_rows(app[1], "energy.meter.create")


# ---------------------------------------------------------------- RBAC

def test_permissions_and_403_before_body(app):
    c, settings = app
    mid = create(c, "sensor.main_energy").json()["id"]
    bind(c, settings, "dana", "viewer", "installation", "*")
    bind(c, settings, "omer", "operator", "installation", "*")
    bind(c, settings, "sara", "site_admin", "installation", "*")
    v, o, s = as_user("dana"), as_user("omer"), as_user("sara")
    assert c.get(f"{API}/meters", headers=v).status_code == 403
    assert c.get(f"{API}/meters", headers=o).status_code == 200  # operator holds energy.view
    assert c.get(f"{API}/candidates", headers=o).status_code == 403
    # garbage body and a wrong content type: still 403 (the permission comes before the body) and audited
    before = len(audit_rows(settings, "energy.manage"))
    r = c.post(f"{API}/meters", headers={**o, "content-type": "text/plain"}, content=b"{{{not json")
    assert r.status_code == 403
    r = c.patch(f"{API}/meters/{mid}", headers=o, content=b"x" * 100, )
    assert r.status_code == 403
    assert len(audit_rows(settings, "energy.manage")) == before + 2
    assert all(row["decision"] == "denied" for row in audit_rows(settings, "energy.manage"))
    # site_admin manages meters but not the retention values
    assert c.patch(f"{API}/meters/{mid}", headers=s, json={"revision": 1, "display_name": "ראשי"}).status_code == 200
    assert c.patch(f"{API}/settings", headers=s, json={"energy.stale_after_minutes": 30}).status_code == 200
    r = c.patch(f"{API}/settings", headers=s, json={"energy.raw_retention_days": 30})
    assert r.status_code == 403
    assert c.patch(f"{API}/settings", headers=o, json={"energy.stale_after_minutes": 30}).status_code == 403
    assert c.get(f"{API}/settings", headers=o).json()["editable"]["energy.stale_after_minutes"] is False


def test_permissions_registered():
    from smplwise.rbac import ROLES
    from smplwise.routers.access import PERMISSION_LABELS, SENSITIVE

    for p in ("energy.view", "energy.bills", "energy.manage"):
        assert PERMISSION_LABELS[p]
    assert "energy.bills" in SENSITIVE and "energy.view" not in SENSITIVE
    assert {p for p in ROLES["operator"] if p.startswith("energy.")} == {"energy.view"}
    for role in ("site_admin", "system_admin"):
        assert {p for p in ROLES[role] if p.startswith("energy.")} == {"energy.view", "energy.bills", "energy.manage"}
    for role in ("viewer", "kiosk", "editor"):
        assert not [p for p in ROLES[role] if p.startswith("energy.")]


# ---------------------------------------------------------------- registry lifecycle

def test_patch_pause_retire_and_in_use(app):
    c, settings = app
    m = create(c, "sensor.main_energy").json()
    r = c.patch(f"{API}/meters/{m['id']}", json={"revision": 99, "display_name": "x"})
    assert r.status_code == 409 and r.json()["code"] == "revision_conflict"
    r = c.patch(f"{API}/meters/{m['id']}", json={"revision": 1, "status": "paused"})
    assert r.json()["status"] == "paused" and r.json()["state"] == "paused" and r.json()["status_reason"] == "manual"
    with Database(settings.db_path).connection() as conn:  # the billing branch's tables (contract 2.3)
        conn.execute("CREATE TABLE energy_accounts(id TEXT PRIMARY KEY, name TEXT, status TEXT, deleted_at TEXT)")
        conn.execute("CREATE TABLE energy_account_meters(account_id TEXT, meter_id TEXT)")
        conn.execute("INSERT INTO energy_accounts VALUES ('a1', 'דירה 3', 'active', NULL)")
        conn.execute("INSERT INTO energy_account_meters VALUES ('a1', ?)", (m["id"],))
    r = c.delete(f"{API}/meters/{m['id']}", params={"revision": 2})
    assert r.status_code == 409 and r.json()["code"] == "meter_in_use" and r.json()["details"]["accounts"][0]["name"] == "דירה 3"
    assert c.get(f"{API}/meters/{m['id']}").json()["used_in"] == [{"account_id": "a1", "name": "דירה 3"}]
    listed = c.get(f"{API}/meters").json()["items"][0]
    assert listed["accounts_count"] == 1 and {"floor_id", "floor_name", "area_name", "month_kwh", "today_kwh"} <= set(listed)
    with Database(settings.db_path).connection() as conn:
        conn.execute("UPDATE energy_accounts SET deleted_at = '2026-10-04T00:00:00Z'")
    r = c.delete(f"{API}/meters/{m['id']}", params={"revision": 2})
    assert r.status_code == 200 and r.json()["status"] == "retired"
    assert c.get(f"{API}/meters").json()["items"] == []
    assert len(c.get(f"{API}/meters", params={"include_retired": "true"}).json()["items"]) == 1
    assert create(c, "sensor.main_energy").status_code == 201  # the entity may be registered again after retirement


# ---------------------------------------------------------------- sampling from the mirror

def _tick(settings, at: dt.datetime):
    return energy_sampler.tick(Database(settings.db_path), settings, now=at.timestamp(), require_connection=False)


def test_sampler_series_consumption_and_status(app, monkeypatch):
    c, settings = app
    m = create(c, "sensor.main_energy").json()
    t = local(2026, 10, 4, 10)
    for k in range(5):
        set_state(settings, "sensor.main_energy", f"{12345.678 + k * 0.25:.3f}")
        assert _tick(settings, t + dt.timedelta(minutes=k))["samples"] == 1
    monkeypatch.setattr(ha_sync.STATE, "connected", False)  # other tests leave the shared flag on
    assert energy_sampler.tick(Database(settings.db_path), settings, now=t.timestamp())["skipped"] == "disconnected"  # no session, no sample
    r = c.get(f"{API}/meters/{m['id']}/readings", params={"from": iso(t), "to": iso(t + dt.timedelta(hours=1))})
    assert [i["wh"] for i in r.json()["items"]] == [12345678, 12345928, 12346178, 12346428, 12346678]
    r = c.get(f"{API}/consumption", params={"meter_ids": m["id"], "from": iso(t), "to": iso(t + dt.timedelta(minutes=15))})
    item = r.json()["items"][0]
    assert item["wh"] == 1000 and item["kwh"] == 1.0 and item["coverage"] == "partial" and item["covered_seconds"] == 240
    r = c.get(f"{API}/meters/{m['id']}/series", params={"from": iso(t), "to": iso(t + dt.timedelta(hours=1)), "step": "15m"})
    items = r.json()["items"]
    assert len(items) == 4 and items[0]["wh"] == 1000 and items[1]["wh"] is None and items[0]["coverage"] == "partial"
    r = c.get(f"{API}/meters/{m['id']}/series", params={"from": iso(local(2026, 10, 4)), "to": iso(local(2026, 10, 5)), "step": "1d"})
    assert r.json()["items"][0]["date"] == "2026-10-04" and r.json()["items"][0]["kwh"] == 1.0
    # status: reporting relative to the provider clock
    from smplwise.services import energy_provider

    monkeypatch.setattr(energy_provider.EnergyProvider, "now", lambda self: int((t + dt.timedelta(minutes=10)).timestamp()))
    meter = c.get(f"{API}/meters").json()["items"][0]
    assert meter["state"] == "reporting" and meter["value_kwh"] == 12346.678 and meter["last_report_at"] == iso(t + dt.timedelta(minutes=4))
    monkeypatch.setattr(energy_provider.EnergyProvider, "now", lambda self: int((t + dt.timedelta(hours=3)).timestamp()))
    assert c.get(f"{API}/meters").json()["items"][0]["state"] == "not_reporting"
    assert c.get(f"{API}/meters/{m['id']}/series", params={"from": iso(t - dt.timedelta(days=60)), "to": iso(t), "step": "15m"}).status_code == 422


def test_unit_change_pauses_the_meter(app):
    c, settings = app
    m = create(c, "sensor.main_energy").json()
    _tick(settings, local(2026, 10, 4, 10))
    set_state(settings, "sensor.main_energy", "3100", {"unit_of_measurement": "W"})
    res = _tick(settings, local(2026, 10, 4, 10, 1))
    assert res["paused"] == [m["id"]]
    got = c.get(f"{API}/meters/{m['id']}").json()
    assert got["status"] == "paused" and got["status_reason"] == "unit_changed"
    assert audit_rows(settings, "energy.meter.pause")
    r = c.patch(f"{API}/meters/{m['id']}", json={"revision": got["revision"], "status": "active"})
    assert r.status_code == 422 and r.json()["details"]["code"] == "unit_changed"


def test_replace_endpoint_new_source(app):
    c, settings = app
    m = create(c, "sensor.main_energy").json()
    t = dt.datetime.now(UTC).replace(second=0, microsecond=0) + dt.timedelta(minutes=1)  # after the first epoch began (now)
    set_state(settings, "sensor.main_energy", "100.000")
    _tick(settings, t)
    set_state(settings, "sensor.main_energy", "101.000")
    _tick(settings, t + dt.timedelta(minutes=1))
    r = c.post(f"{API}/meters/{m['id']}/replace", json={"revision": m["revision"], "at": iso(t + dt.timedelta(minutes=2)), "old_final_reading_kwh": 101.5,
                                                        "new_start_reading_kwh": 0, "new_source_ref": "sensor.site_mwh", "note": "הוחלף מונה"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["source_ref"] == "sensor.site_mwh" and body["unit"] == "MWh" and [e["reason"] for e in body["epochs"]] == ["first", "source_changed"]
    assert body["epochs"][0]["end_reading_kwh"] == 101.5
    floor = dt.datetime.fromtimestamp(int(t.timestamp()) // 900 * 900, UTC)  # whole quarter hours around the readings
    r = c.get(f"{API}/consumption", params={"meter_ids": m["id"], "from": iso(floor), "to": iso(floor + dt.timedelta(minutes=30))})
    assert r.json()["items"][0]["wh"] == 1500
    assert any(e["kind"] == "replaced" for e in r.json()["items"][0]["events"])
    rows = audit_rows(settings, "energy.meter.replace")
    assert rows and json.loads(rows[-1]["details_json"])["reason"] == "source_changed"


# ---------------------------------------------------------------- settings

def test_settings_values_ranges_and_estimate(app):
    c, _ = app
    create(c, "sensor.main_energy")
    r = c.get(f"{API}/settings").json()
    assert r["values"]["energy.raw_retention_days"] == 90 and r["values"]["energy.interval_retention_months"] == 26
    assert r["values"]["energy.bill_retention_years"] == 7 and r["values"]["energy.include_history_in_backup"] is False
    assert r["storage"]["estimate"]["meters"] == 1 and r["storage"]["estimate"]["total_bytes"] > 0
    assert all(r["editable"].values())  # system_admin
    assert r["storage"]["classes"]["drafts"] == {"rows": 0, "bytes_estimate": 0}  # the billing branch's drafts, before its table exists
    assert c.patch(f"{API}/settings", json={"energy.raw_retention_days": 3}).status_code == 422
    assert c.patch(f"{API}/settings", json={"energy.raw_retention_days": "30"}).status_code == 422
    assert c.patch(f"{API}/settings", json={"energy.nope": 1}).status_code == 422
    r = c.patch(f"{API}/settings", json={"energy.raw_retention_days": 30, "energy.include_history_in_backup": True})
    assert r.status_code == 200 and r.json()["values"]["energy.raw_retention_days"] == 30
    assert r.json()["storage"]["estimate"]["raw_bytes"] == 1 * 1440 * 30 * 32
    assert c.patch(f"{API}/settings", content=b"[]", headers={"content-type": "application/json"}).status_code == 422


# ---------------------------------------------------------------- backup / restore

def test_backup_carries_daily_and_optional_history_restore_allow_list(app, tmp_path):
    from smplwise.config import Settings
    from smplwise.services import backup

    c, settings = app
    m = create(c, "sensor.main_energy").json()
    t = local(2026, 10, 3, 10)
    for k, v in enumerate(("1.000", "2.000", "3.500")):
        set_state(settings, "sensor.main_energy", v)
        _tick(settings, t + dt.timedelta(hours=k))
    db = Database(settings.db_path)
    with db.connection() as conn:
        e1 = backup.create(settings, conn, note="t")
    with zipfile.ZipFile(backup.backups_dir(settings) / e1["name"]) as z:
        names = set(z.namelist())
        assert "data/energy_meters.json" in names and "energy/daily.json" in names and "energy/energy.db" not in names
        daily = json.loads(z.read("energy/daily.json"))
        assert daily == [{"meter": m["id"], "date": "2026-10-03", "wh": 2500, "covered_s": 7200, "day_s": 86400, "quality_max": 1}]
    c.patch(f"{API}/settings", json={"energy.include_history_in_backup": True})
    with db.connection() as conn:
        e2 = backup.create(settings, conn, note="history")
    with zipfile.ZipFile(backup.backups_dir(settings) / e2["name"]) as z:
        assert "energy/energy.db" in z.namelist()
    # restore into a fresh installation: the meter row comes with the project, its time-series through the allow-list
    other = Settings(**{**settings.__dict__, "data_dir": tmp_path / "other"})
    from smplwise.main import create_app

    TestClient(create_app(other)).get("/api/v1/me")
    odb = Database(other.db_path)
    src = backup.backups_dir(settings) / e2["name"]
    with odb.connection() as conn:
        res = backup.restore(other, conn, src, mode="replace")
    assert res["energy"]["history"]["readings"] == 3
    store = st.store_for(other)
    assert store.daily(m["id"], dt.date(2026, 10, 3), dt.date(2026, 10, 4))[dt.date(2026, 10, 3)][0] == 2500
    # the daily-only archive restores the totals
    third = Settings(**{**settings.__dict__, "data_dir": tmp_path / "third"})
    TestClient(create_app(third)).get("/api/v1/me")
    with Database(third.db_path).connection() as conn:
        res = backup.restore(third, conn, backup.backups_dir(settings) / e1["name"], mode="replace")
    assert res["energy"]["daily"] == 1 and not res["energy"]["history"]


def test_restore_refuses_a_foreign_energy_file(app, tmp_path):
    from smplwise.services import energy_backup

    c, settings = app
    m = create(c, "sensor.main_energy").json()
    bogus = tmp_path / "bogus.zip"
    import sqlite3

    evil = tmp_path / "evil.db"
    con = sqlite3.connect(evil)
    con.execute("CREATE TABLE readings(x)")
    con.commit()
    con.close()
    with zipfile.ZipFile(bogus, "w") as z:
        z.write(evil, "energy/energy.db")
        z.writestr("energy/daily.json", json.dumps([{"meter": "not-a-meter", "date": "2026-01-01", "wh": 5}, {"meter": m["id"], "date": "bad", "wh": 1}]))
    with zipfile.ZipFile(bogus) as z:
        out = energy_backup.restore_from_zip(settings, z, set(z.namelist()), allowed_meters={m["id"]}, replace=False)
    assert out["history"] == {} and "history_refused" in out and out["daily"] == 0
