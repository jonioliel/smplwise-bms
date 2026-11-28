"""FIX-UTIL-A-2570: the emergency readiness findings of the second deep review (docs/review/DEEP-REVIEW-2570-COMMS-UTILITIES.md).

CU2-04 the permissions are judged at the INSTALLATION (a manager bound to one floor may not change or read the building's readiness);
CU2-05 E02b "the building is on the mains" while mains is reported down; CU2-15 E19 green for an unread recorder clock, E18 green with a
marked emergency camera disabled; CU2-16 E01 aged from the time a test was typed in, not the date it was performed; CU2-17 the janitor
takes the write lock every 30 s. Every test fails on v2.56.0 and passes after the fix. Fakes only: no device, nothing outside the database."""
from __future__ import annotations

import datetime as dt
import types

import pytest
from conftest import bind
import test_emergency_readiness_295 as _base
from test_emergency_readiness_295 import EW, E, NOW

from smplwise.db import Database, new_id
from smplwise.services.emergency import engine
from smplwise.services.emergency import service as svc

ew = _base.ew  # the module's own fixture, under its name


# ---------------------------------------------------------------- CU2-04: installation scope, audited refusals

def test_a_floor_scoped_manager_cannot_configure_or_read_the_contacts(ew: EW) -> None:
    ew.on()
    bind(ew.c, ew.w.settings, "sam", "site_admin", "floor", ew.w.floors["floor2"])  # holds emergency.manage - on floor 2 only
    h = ew.h("sam")
    cfg = ew.c.get(f"{E}/config", headers=ew.h("joni")).json()
    r = ew.c.put(f"{E}/config", json={"revision": cfg["revision"], "not_applicable": {"E03": {"note": "x"}}}, headers=h)
    assert r.status_code == 403, r.text
    r = ew.c.put(f"{E}/config", json={"revision": cfg["revision"], "thresholds": {"generator_test_amber_days": 730}}, headers=h)
    assert r.status_code == 403
    assert ew.c.get(f"{E}/contacts", headers=h).status_code == 403
    assert ew.c.post(f"{E}/contacts", json={"display_name": "x", "phone": "0501234567"}, headers=h).status_code == 403
    assert ew.c.get(E, headers=h).status_code == 403
    assert ew.c.get(f"{E}/module", headers=h).json()["can"] == {"view": False, "manage": False}
    denied = ew.rows("SELECT action, reason FROM audit_log WHERE decision = 'denied' AND actor_user_id = 'dev-sam'")
    assert denied and {r["action"] for r in denied} >= {"emergency.manage", "emergency.view"}
    assert ew.items()["E03"]["status"] == "red", "nothing was marked not applicable"
    # the same role at the installation keeps working
    bind(ew.c, ew.w.settings, "ira", "site_admin", "installation", "*")
    assert ew.c.put(f"{E}/config", json={"thresholds": {"backup_green_days": 3}}, headers=ew.h("ira")).status_code == 200


# ---------------------------------------------------------------- CU2-05: E02b during a blackout

def _gen(mains, *, on_load=None, ats=None, avail="online", age_s=10.0, stale_s=300):
    def v(x):
        return {"value": x, "available": x is not None}

    return {"id": "g1", "name": "גנרטור", "values": {"mains_available": v(mains), "on_load": v(on_load), "ats_position": v(ats)}, "avail": avail,
            "alerts": [], "ledger_done": None, "ledger_on": None, "age_s": age_s, "stale_s": stale_s}


@pytest.fixture()
def fake_gens(monkeypatch):
    box: dict[str, list] = {"gens": []}
    monkeypatch.setattr(engine, "_generators", lambda ctx: box["gens"])
    return box


def test_e02b_mains_down_and_no_generator_on_load_is_red_with_a_banner(fake_gens) -> None:
    ctx = types.SimpleNamespace(conn=None, settings=None)
    fake_gens["gens"] = [_gen(False, on_load=False)]
    r = engine.e02b(ctx)
    assert (r["status"], r["code"]) == ("red", "no_mains") and "הבניין על הרשת" not in r["summary"]
    assert [b["code"] for b in engine.banners(ctx)] == ["no_mains"]
    fake_gens["gens"] = [_gen(False, on_load=True)]
    assert engine.e02b(ctx)["code"] == "on_load"
    fake_gens["gens"] = [_gen(True, on_load=False)]
    assert (engine.e02b(ctx)["status"], engine.e02b(ctx)["code"]) == ("green", "on_mains")


def test_e02b_stale_or_unavailable_mains_is_unknown_never_green(fake_gens) -> None:
    ctx = types.SimpleNamespace(conn=None, settings=None)
    fake_gens["gens"] = [_gen(True, age_s=3600, stale_s=300)]
    assert engine.e02b(ctx)["status"] == "unknown"
    fake_gens["gens"] = [_gen(False, avail="stale")]
    assert engine.e02b(ctx)["status"] == "unknown"
    fake_gens["gens"] = [_gen(None)]
    assert engine.e02b(ctx)["status"] == "unknown"


# ---------------------------------------------------------------- CU2-15: E19 unread clock, E18 disabled emergency camera

def test_e19_an_unread_recorder_clock_is_unknown(monkeypatch) -> None:
    from smplwise.services import health_report

    monkeypatch.setattr(health_report, "_recorder_time_checks", lambda settings, conn: [
        {"id": "recorder_time_r1", "status": "ok", "meta": {"known": False}},
        {"id": "recorder_time_r2", "status": "ok", "meta": {"known": True}}])
    r = engine.e19(types.SimpleNamespace(conn=None, settings=object()))
    assert (r["status"], r["code"]) == ("unknown", "clock_unread")
    monkeypatch.setattr(health_report, "_recorder_time_checks", lambda settings, conn: [{"id": "recorder_time_r2", "status": "ok", "meta": {"known": True}}])
    assert engine.e19(types.SimpleNamespace(conn=None, settings=object()))["status"] == "green"


def test_e18_a_marked_camera_that_was_disabled_counts_as_offline(ew: EW) -> None:
    ew.on()
    rec, cam, other = new_id(), new_id(), new_id()
    with ew.db.connection() as conn:
        conn.execute("INSERT INTO recorders(id, name, created_at) VALUES (?, 'r', 't')", (rec,))
        for cid, ch in ((cam, 1), (other, 2)):
            conn.execute("INSERT INTO cameras(id, recorder_id, channel, status, created_at, updated_at) VALUES (?, ?, ?, 'online', 't', 't')", (cid, rec, ch))
    assert ew.c.put(f"{E}/config", json={"cameras": [cam]}, headers=ew.h("joni")).status_code == 200
    assert ew.items()["E18"]["status"] == "green"
    with ew.db.connection() as conn:
        conn.execute("UPDATE cameras SET enabled = 0 WHERE id = ?", (cam,))
    e18 = ew.items()["E18"]
    assert e18["status"] == "red" and e18["critical"] is True
    assert {f["key"]: f["value"] for f in e18["facts"]}["marked_offline"] == 1


# ---------------------------------------------------------------- CU2-16: E01 ages the ledger test from the date it was performed

def test_e01_ledger_age_is_from_the_performed_date(fake_gens) -> None:
    g = _gen(None, avail="offline")
    g["values"] = {}
    g["ledger_done"] = "2027-01-15T09:00:00Z"   # typed in this morning ...
    g["ledger_on"] = "2026-10-15"               # ... for a test performed three months ago
    fake_gens["gens"] = [g]
    ctx = types.SimpleNamespace(conn=None, settings=None, now=NOW, now_iso="2027-01-15T10:00:00Z", today=dt.date(2027, 1, 15),
                                th=__import__("smplwise.services.emergency.model", fromlist=["x"]).default_thresholds())
    assert engine.e01(ctx)["status"] == "red", "92 days old: past the amber bound, never 'amber' because it was typed today"
    g["ledger_on"] = "2027-01-10"
    assert engine.e01(ctx)["status"] == "amber", "the ledger completion alone is amber at best"


# ---------------------------------------------------------------- CU2-17: the janitor reads first and writes only when a row is due

def test_janitor_is_throttled_and_takes_the_write_lock_only_for_a_change(ew: EW, monkeypatch) -> None:
    ew.on()
    db = Database(ew.w.settings.db_path)
    modes: list[str] = []
    real = Database.connection

    def spy(self, *a, **kw):
        modes.append(kw.get("mode", "write"))
        return real(self, *a, **kw)

    monkeypatch.setattr(Database, "connection", spy)
    svc._LAST["janitor"] = 0.0
    svc.janitor(db, None, now=1_000_000.0)
    assert modes[0] == "read" and modes.count("write") == 1, "the first pass reads, then writes the first history row"
    modes.clear()
    svc.janitor(db, None, now=1_000_010.0)
    assert modes == [], "throttled: nothing at all 10 s later"
    svc.janitor(db, None, now=1_000_400.0)
    assert modes and "write" not in modes, "nothing changed: no write lock"
    with Database(ew.w.settings.db_path).connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM emergency_readiness_history").fetchone()[0] == 1
