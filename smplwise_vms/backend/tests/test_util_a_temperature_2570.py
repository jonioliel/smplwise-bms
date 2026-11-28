"""FIX-UTIL-A-2570: the temperature findings of the second deep review (docs/review/DEEP-REVIEW-2570-COMMS-UTILITIES.md).

CU2-06 an excursion escalated to ALARM while the reading was already back inside the band (within the hysteresis); CU2-14 the HACCP day
verdict "OK" whatever the data coverage; CU2-18 one bad unit rolled back the pass of every unit; CU2-22 the HACCP report unbounded.
A fake mirror and a fake clock (the module's own fixture); every test fails on v2.56.0 and passes after the fix."""
from __future__ import annotations

import datetime as dt

import test_infra_temperature as _base
from test_infra_temperature import API, T0, create, events, iso, notes, run, tick

from smplwise.services import temperature as t
from smplwise.services import temperature_report as rep
from smplwise.services import temperature_runtime as rt

app = _base.app  # the module's own fixture, under its name


# ---------------------------------------------------------------- CU2-06

def test_no_alarm_while_the_reading_is_back_inside_the_band_within_the_hysteresis(app):
    c, db, *_ = app
    uid = create(c, rules={"high_alarm_min": 5})            # band 2..6, hysteresis 0.3
    ts = run(db, "sensor.fridge_temp", [6.1] + [5.9] * 10, T0)  # one minute above, then 5.9 (inside, not past the hysteresis)
    high = [e for e in events(db, uid) if e["kind"] == "high"]
    assert len(high) == 1 and high[0]["ended_at"] is None, "still open: no flapping on the line"
    assert high[0]["severity"] == "warning" and high[0]["alarmed_at"] is None, "never an alarm on a reading inside the band"
    assert not notes(db, "temperature.alarm")
    # outside again: the minutes outside add up (paused, not reset) - 1 + 4 = 5 minutes outside -> the alarm
    ts = run(db, "sensor.fridge_temp", [6.2] * 5, ts + 60)
    high = [e for e in events(db, uid) if e["kind"] == "high"][0]
    assert high["severity"] == "alarm" and high["alarmed_at"] is not None
    assert len(notes(db, "temperature.alarm")) == 1


def test_an_alarm_does_not_escalate_while_the_reading_is_back_inside(app):
    c, db, *_ = app
    from smplwise.services import temperature_alerts

    with db.connection() as conn:
        cfg = temperature_alerts.load(conn)
    uid = create(c, rules={"high_alarm_min": 1})
    ts = run(db, "sensor.fridge_temp", [6.5, 6.5, 6.5], T0)
    assert [e for e in events(db, uid) if e["kind"] == "high"][0]["severity"] == "alarm"
    # back inside (5.9 <= 6) but within the hysteresis for a long time: the chain (if any) waits
    ts = run(db, "sensor.fridge_temp", [5.9] * 90, ts + 60)
    high = [e for e in events(db, uid) if e["kind"] == "high"][0]
    assert high["ended_at"] is None
    assert int(high["escalation_level"] or 0) == 0, (cfg["escalation"], "no escalation step while the reading is inside the band")


# ---------------------------------------------------------------- CU2-14

def test_haccp_day_with_poor_coverage_is_partial_not_ok():
    st_full = {"samples": 1440, "out_min": 0, "alarms": 0}
    assert rep._day_verdict(st_full, 100.0) == "ok"
    assert rep._day_verdict({"samples": 1, "out_min": 0, "alarms": 0}, 1.0) == "partial"
    assert rep._day_verdict({"samples": 1, "out_min": 3, "alarms": 0}, 1.0) == "exc", "an excursion stays an excursion"
    assert rep._day_verdict({"samples": 0, "out_min": 0, "alarms": 0}, 0.0) == "none"
    assert rep.LABELS["he"]["v_partial"] and rep.LABELS["en"]["v_partial"] == "Partial data"


def test_haccp_preview_marks_an_offline_day_partial(app):
    c, db, _s, clk = app
    uid = create(c, door_entity_id=None)
    from test_infra_temperature import TZ

    day = dt.datetime(2026, 10, 17, 0, 0, tzinfo=TZ).timestamp()
    with db.connection() as conn:
        for m in range(0, 1440):
            t.record_sample(conn, uid, int(day + m * 60), 4.0, 0)       # day 1: every minute
        t.record_sample(conn, uid, int(day + 1440 * 60 + 600), 4.0, 0)  # day 2: ONE in-band sample (offline 23 h)
    clk["ts"] = day + 2 * 86400 + 3600
    r = c.get(f"{API}/report/preview?units={uid}&range=custom&from={iso(day)}&to={iso(day + 2 * 86400)}&layout=haccp")
    assert r.status_code == 200, r.text
    rows = r.json()["units"][0]["daily"]
    assert [d["verdict"] for d in rows] == ["ok", "partial"]


# ---------------------------------------------------------------- CU2-18

def test_one_bad_unit_does_not_roll_back_the_others(app, monkeypatch):
    c, db, *_ = app
    good = create(c, rules={"high_alarm_min": 5})
    bad = create(c, name="מקפיא", temp_entity_id="sensor.freezer_temp", door_entity_id=None, low=-25, high=-15)
    real = t.band_of

    def broken(u, reading, rules):
        if u["id"] == bad:
            raise RuntimeError("a broken unit")
        return real(u, reading, rules)

    monkeypatch.setattr(t, "band_of", broken)
    out = run(db, "sensor.fridge_temp", [7.0], T0) and tick(db, T0 + 60)
    assert out["failed"] == 1
    with db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM infra_temp_samples WHERE unit_id = ?", (good,)).fetchone()[0] >= 1
    assert [e["kind"] for e in events(db, good) if e["kind"] == "high"] == ["high"], "the good unit's excursion is recorded"


# ---------------------------------------------------------------- CU2-22

def test_haccp_report_is_bounded(app):
    c, db, _s, clk = app
    uids = [create(c, name=f"יחידה {i}", door_entity_id=None) for i in range(9)]
    clk["ts"] = T0
    lo, hi = T0 - 380 * 86400, T0 - 10
    q = f"units={','.join(uids)}&range=custom&from={iso(lo)}&to={iso(hi)}"
    r = c.get(f"{API}/report/preview?{q}&layout=haccp")
    assert r.status_code == 422 and r.json()["code"] == "report_too_large", r.text
    assert c.get(f"{API}/report/preview?{q}&layout=standard").status_code == 200, "the standard layout is not a per-day table"
    one = c.get(f"{API}/report/preview?units={uids[0]}&range=custom&from={iso(lo)}&to={iso(hi)}&layout=haccp")
    assert one.status_code == 200
    assert rt is not None
