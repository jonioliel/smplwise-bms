"""CR-INFRA-TEMPERATURE phase 3 (the accepted improvement ideas, owner 2026-10-20): a fake mirror and a fake clock only (no Home Assistant).

Negative cases first (validation, permissions), then: the time-to-threshold projection and its optional early warning, the maintenance
window (holds warnings; alarms only when chosen - owner: alarms are never silenced), the escalation chain of an unacknowledged alarm,
sensor health (battery / signal of the sensor's device, a frozen reading), the door correlation and the compressor duty cycle, the HACCP
daily table, the service ticket from an alarm (chart picture, two-way link, dedupe) and the grid's floor grouping."""
from __future__ import annotations

import datetime as dt
import json

import pytest
from conftest import as_user, bind
from test_infra_temperature import API, T0, TZ, add_entity, app, body, create, events, iso, notes, run, set_state, tick  # noqa: F401 - `app` is the fixture

from smplwise.db import Database
from smplwise.services import temperature as t
from smplwise.services import temperature_insights as ti
from smplwise.services import temperature_runtime as rt

UTC = dt.timezone.utc


def unit_rules(db: Database, uid: str, **rules) -> None:
    with db.connection() as conn:
        cur = json.loads(conn.execute("SELECT rules_json FROM infra_temp_units WHERE id = ?", (uid,)).fetchone()[0] or "{}")
        cur.update(rules)
        conn.execute("UPDATE infra_temp_units SET rules_json = ? WHERE id = ?", (json.dumps(cur), uid))


def device_of(db: Database, eid: str, device: str) -> None:
    with db.connection() as conn:
        conn.execute("UPDATE ha_entities SET device_id = ? WHERE entity_id = ?", (device, eid))


def ev_kinds(db: Database, uid: str) -> list[str]:
    return [e["kind"] for e in events(db, uid)]


# ---------------------------------------------------------------- pure helpers

@pytest.mark.parametrize("v,rate,expect", [
    (4.0, 0.1, ("high", 20)),       # (6 - 4) / 0.1
    (3.0, -0.05, ("low", 20)),      # (3 - 2) / 0.05
    (4.0, 0.005, None),             # too slow: noise, not a trend
    (4.0, 0.01, None),              # 200 min away: beyond the 60 min horizon
    (7.0, 0.2, None),               # already out of the band: not a prediction
    (None, 0.2, None),
    (4.0, None, None),
])
def test_predict_projection(v, rate, expect):
    p = t.predict(v, rate, 2.0, 6.0, 60)
    assert (p and (p["side"], p["eta_min"])) == expect if expect else p is None


def test_door_effects_rise_and_recovery():
    # minute points: 4.0 baseline, the door opens at minute 100 for 2 minutes, the reading climbs to 8 and returns linearly over 20 minutes
    pts: list[tuple[float, float]] = []
    for m in range(0, 200):
        v = 4.0
        if 100 <= m < 102:
            v = 4.0 + (m - 99) * 2
        elif 102 <= m < 122:
            v = 8.0 - (m - 102) * 0.2
        pts.append((m * 60.0, round(v, 2)))
    eff = ti.door_effects(pts, [(100 * 60.0, 102 * 60.0)], 200 * 60.0)
    assert len(eff) == 1
    e = eff[0]
    assert e["base"] == 4.0 and e["peak"] == 8.0 and e["rise"] == 4.0
    assert 14 <= e["recovery_min"] <= 18  # back within max(0.3, 20 % of the rise) of the baseline
    # three such openings with a slow threshold of 10 minutes = a suspected cooling fault; with 30 minutes = fine
    three = [dict(e) for _ in range(3)]
    assert ti.door_summary(three, 10)["slow"] is True
    assert ti.door_summary(three, 30)["slow"] is False
    assert ti.door_summary(three[:2], 10)["slow"] is False  # too few openings for a verdict


def test_door_effect_interrupted_by_the_next_opening_is_not_unrecovered():
    pts = [(m * 60.0, 4.0 if m < 100 else 7.0 if m < 110 else 9.0) for m in range(0, 160)]
    eff = ti.door_effects(pts, [(100 * 60.0, 101 * 60.0), (110 * 60.0, 111 * 60.0)], 160 * 60.0)
    assert eff[0]["recovery_min"] is None and eff[0]["interrupted"] is True
    assert ti.door_summary(eff, 30)["unrecovered"] == 1  # only the second (never recovered, not interrupted)


def test_duty_cycle_days_and_rise():
    tz = TZ
    day0 = dt.datetime(2026, 10, 10, 0, 0, tzinfo=tz).timestamp()
    buckets = []
    for d in range(8):
        pct = 30 if d < 5 else 60  # the last three full days run twice as long
        for b in range(288):
            on = 5 if (b * 100 // 288) < pct else 0
            buckets.append((day0 + d * 86400 + b * 300, 5, on))
    days = ti.duty_days(buckets, tz, day0, day0 + 8 * 86400)
    assert len(days) == 8 and abs(days[0]["pct"] - 30) < 1
    s = ti.duty_summary(days, 15, "2026-10-18")
    assert s["rising"] is True and s["recent"] > s["before"] + 15
    assert ti.duty_summary(days, 40, "2026-10-18")["rising"] is False


def test_chart_png_renders():
    from smplwise.services import temperature_chart_png as png

    pts = [[T0 + i * 300, 4 + (i % 10) * 0.5, None] for i in range(288)]
    data = png.render(pts, 2, 6, int(T0), int(T0 + 86400), TZ, doors=[[int(T0 + 3600), int(T0 + 3900)]], defrost=[[int(T0 + 7200), int(T0 + 9000)]],
                      mark=(T0 + 3000, None))
    assert data[:8] == b"\x89PNG\r\n\x1a\n" and len(data) > 2000


# ---------------------------------------------------------------- validation and permissions

def test_power_sensor_validation_and_candidates(app):
    c, db, _s, _clk = app
    add_entity(db, "sensor.fridge_plug", "80", unit="W", device_class="power")
    r = c.post(API, json=body(power_entity_id="sensor.humidity"))
    assert r.status_code == 422 and r.json()["code"] == "not_power_sensor"
    r = c.post(API, json=body(power_entity_id="sensor.nope"))
    assert r.json()["code"] == "sensor_not_found"
    uid = create(c, power_entity_id="sensor.fridge_plug")
    m = next(u for u in c.get(f"{API}/manage").json()["units"] if u["id"] == uid)
    assert m["power_entity_id"] == "sensor.fridge_plug" and m["power_sensor_name"] == "שם fridge_plug"
    items = c.get(f"{API}/candidates?kind=power").json()["items"]
    assert [i["entity_id"] for i in items] == ["sensor.fridge_plug"] and items[0]["watts"] == 80.0


@pytest.mark.parametrize("patch", [{"predict_horizon_min": 1}, {"battery_low_pct": 90}, {"compressor_on_w": 0}, {"maintenance_max_min": 5},
                                   {"frozen_min": -1}, {"predict_warn": "yes"}])
def test_phase3_rules_are_validated(app, patch):
    c, *_ = app
    r = c.post(API, json=body(rules=patch))
    assert r.status_code == 422 and r.json()["code"] == "rule_invalid"


def test_installation_only_phase3_settings(app):
    c, *_ = app
    assert c.post(API, json=body(rules={"grid_grouping": "none"})).json()["code"] == "rule_invalid"  # never per unit
    r = c.put(f"{API}/settings", json={"rules": {"grid_grouping": "none", "ticket_department_id": "dept-maintenance", "home_widget": False}})
    assert r.status_code == 200, r.text
    specs = r.json()["rule_specs"]
    assert specs["grid_grouping"]["choices"] == ["area", "none"] and specs["ticket_department_id"]["type"] == "id"
    assert c.put(f"{API}/settings", json={"rules": {"grid_grouping": "floor"}}).status_code == 422
    assert c.put(f"{API}/settings", json={"rules": {"ticket_department_id": "bad id!"}}).status_code == 422
    lst = c.get(API).json()
    assert lst["grouping"] == "none" and lst["home_widget"] is False


def test_maintenance_route_permissions_and_limits(app):
    c, _db, settings, _clk = app
    uid = create(c)
    bind(c, settings, "ops", "operator", "installation", "*")
    bind(c, settings, "vera", "viewer", "installation", "*")
    assert c.post(f"{API}/{uid}/maintenance", json={"minutes": 30, "reason": "ניקוי"}, headers=as_user("vera")).status_code == 403
    r = c.post(f"{API}/{uid}/maintenance", json={"minutes": 300, "reason": "ניקוי"}, headers=as_user("ops"))
    assert r.status_code == 422 and r.json()["code"] == "maint_too_long"
    r = c.post(f"{API}/{uid}/maintenance", json={"minutes": 30, "reason": "   "}, headers=as_user("ops"))
    assert r.status_code == 422 and r.json()["code"] == "maint_reason"
    assert c.delete(f"{API}/{uid}/maintenance", headers=as_user("ops")).json()["code"] == "not_in_maintenance"
    r = c.post(f"{API}/{uid}/maintenance", json={"minutes": 30, "reason": "ניקוי שבועי"}, headers=as_user("ops"))
    assert r.status_code == 200, r.text
    u = c.get(f"{API}/{uid}", headers=as_user("vera")).json()
    assert u["maintenance"]["reason"] == "ניקוי שבועי" and u["maintenance"]["by_name"]
    assert c.post(f"{API}/nope/maintenance", json={"minutes": 30, "reason": "x"}, headers=as_user("ops")).status_code == 404


def test_escalation_settings_validation(app):
    c, *_ = app
    a = c.get(f"{API}/alerts").json()
    assert a["kinds_order"] == ["alarm", "warning", "offline", "health"]
    assert a["escalation"]["enabled"] is True and [s["after_min"] for s in a["escalation"]["steps"]] == [15, 45]
    bad = {"escalation": {"steps": [{"after_min": 30, "recipients": {"roles": ["system_admin"]}}, {"after_min": 20, "recipients": {"roles": ["site_admin"]}}]}}
    r = c.put(f"{API}/alerts", json=bad)
    assert r.status_code == 422 and r.json()["code"] == "escalation_step"
    five = {"escalation": {"steps": [{"after_min": i * 10, "recipients": {"roles": ["system_admin"]}} for i in range(1, 6)]}}
    assert c.put(f"{API}/alerts", json=five).status_code == 422
    ok = {"escalation": {"enabled": True, "channels": ["push"], "steps": [{"after_min": 5, "recipients": {"roles": ["system_admin"]}}]}}
    r = c.put(f"{API}/alerts", json=ok)
    assert r.status_code == 200 and r.json()["escalation"]["steps"] == [{"after_min": 5, "recipients": {"roles": ["system_admin"], "users": [], "groups": []}}]


# ---------------------------------------------------------------- the evaluator: maintenance, escalation, prediction, health

def test_maintenance_holds_warnings_not_alarms_by_default(app):
    c, db, _s, clk = app
    uid = create(c, door_entity_id=None, rules={"high_alarm_min": 10})
    assert c.post(f"{API}/{uid}/maintenance", json={"minutes": 60, "reason": "מילוי סחורה"}).status_code == 200
    run(db, "sensor.fridge_temp", [9] * 13, T0)
    evs = [e for e in events(db, uid) if e["kind"] == "high"]
    assert evs and evs[0]["severity"] == "alarm"
    assert notes(db, "temperature.warning") == []  # the warning was held (logged with the reason)
    al = notes(db, "temperature.alarm")
    assert len(al) == 1 and "בתחזוקה" in al[0]["body"]  # the alarm went out, saying the unit is in maintenance
    # the window runs out: its log row closes at its own end, the unit leaves maintenance
    tick(db, T0 + 61 * 60)
    m = next(e for e in events(db, uid) if e["kind"] == "maint")
    assert m["ended_at"] is not None and json.loads(m["detail_json"])["reason"] == "מילוי סחורה" and m["ack_by"] == "dev-joni"
    clk["ts"] = T0 + 62 * 60
    assert c.get(f"{API}/{uid}").json()["maintenance"] is None


def test_maintenance_can_hold_alarms_when_chosen(app):
    c, db, *_ = app
    uid = create(c, door_entity_id=None, rules={"high_alarm_min": 5, "maintenance_includes_alarms": True})
    c.post(f"{API}/{uid}/maintenance", json={"minutes": 60, "reason": "טכנאי"})
    run(db, "sensor.fridge_temp", [9] * 8, T0)
    assert notes(db, "temperature.alarm") == []
    assert next(e for e in events(db, uid) if e["kind"] == "high")["suppressed"] == "maintenance"
    # ending early: the held alarm goes out on the next pass
    assert c.delete(f"{API}/{uid}/maintenance").status_code == 200
    tick(db, T0 + 9 * 60)
    assert len(notes(db, "temperature.alarm")) == 1


def test_escalation_chain_until_acknowledged(app):
    c, db, *_ = app
    uid = create(c, door_entity_id=None, rules={"high_alarm_min": 10})
    run(db, "sensor.fridge_temp", [9] * 26, T0)  # alarm at minute 10, step 1 at minute 25
    esc = notes(db, "temperature.escalation")
    assert len(esc) == 1 and "שלב 1" in esc[0]["body"]
    row = next(e for e in events(db, uid) if e["kind"] == "high")
    assert row["escalation_level"] == 1
    assert any(e["kind"] == "escalate" for e in events(db, uid))
    # acknowledged: the step's notification ends, the chain stops climbing
    assert c.post(f"{API}/{uid}/ack").status_code == 200
    assert notes(db, "temperature.escalation")[0]["state"] == "resolved"
    run(db, "sensor.fridge_temp", [9] * 40, T0 + 26 * 60)
    assert len(notes(db, "temperature.escalation")) == 1
    log = c.get(f"{API}/events?unit={uid}&kind=act&range=custom&from={iso(T0 - 60)}&to={iso(T0 + 3 * 3600)}").json()["events"]
    assert {"escalate", "ack"} <= {e["kind"] for e in log}


def test_escalation_reaches_the_second_step_and_can_be_switched_off(app):
    c, db, *_ = app
    uid = create(c, door_entity_id=None, rules={"high_alarm_min": 10})
    run(db, "sensor.fridge_temp", [9] * 56, T0)  # steps at 25 and 55
    assert sorted(n["dedupe_key"][-1] for n in notes(db, "temperature.escalation")) == ["1", "2"]
    # a unit that opts out never escalates
    other = create(c, name="מקפיא", temp_entity_id="sensor.freezer_temp", door_entity_id=None, low=-22, high=-16,
                   rules={"high_alarm_min": 10, "escalation_enabled": False})
    run(db, "sensor.freezer_temp", [-5] * 30, T0 + 60 * 60)
    assert next(e for e in events(db, other) if e["kind"] == "high")["escalation_level"] == 0


def test_prediction_shown_and_early_warning(app):
    c, db, _s, clk = app
    uid = create(c, door_entity_id=None, rules={"predict_warn": True})
    vals = [round(3.0 + 0.1 * i, 2) for i in range(12)]  # +0.1 degrees a minute towards 6
    last = run(db, "sensor.fridge_temp", vals, T0)
    clk["ts"] = last
    u = c.get(f"{API}/{uid}").json()
    assert u["prediction"]["side"] == "high" and 15 <= u["prediction"]["eta_min"] <= 25
    p = next(e for e in events(db, uid) if e["kind"] == "predict")
    assert p["ended_at"] is None and p["severity"] == "warning"
    assert len(notes(db, "temperature.warning")) == 1  # the early warning
    # the excursion starts: the prediction row closes, the excursion row takes over
    run(db, "sensor.fridge_temp", [round(4.3 + 0.1 * i, 2) for i in range(25)], last + 60)
    p = next(e for e in events(db, uid) if e["kind"] == "predict")
    assert p["ended_at"] is not None and "high" in ev_kinds(db, uid)


def test_prediction_is_display_only_by_default(app):
    c, db, *_ = app
    uid = create(c, door_entity_id=None)
    run(db, "sensor.fridge_temp", [round(3.0 + 0.1 * i, 2) for i in range(12)], T0)
    assert "predict" not in ev_kinds(db, uid) and notes(db, "temperature.warning") == []


def test_sensor_health_battery_signal_and_frozen(app):
    c, db, _s, clk = app
    add_entity(db, "sensor.fridge_battery", "12", unit="%", device_class="battery")
    add_entity(db, "sensor.fridge_rssi", "-95", unit="dBm", device_class="signal_strength")
    for e in ("sensor.fridge_temp", "sensor.fridge_battery", "sensor.fridge_rssi"):
        device_of(db, e, "dev-fridge")
    uid = create(c, door_entity_id=None, rules={"frozen_min": 30})
    last = run(db, "sensor.fridge_temp", [4.0] * 36, T0)
    kinds = ev_kinds(db, uid)
    assert "battery" in kinds and "frozen" in kinds
    hn = notes(db, "temperature.health")
    assert len(hn) == 2 and any("סוללת" in n["body"] for n in hn)
    clk["ts"] = last
    h = c.get(f"{API}/{uid}").json()["health"]
    assert h["battery"] == 12 and h["battery_low"] and h["signal"] == -95 and h["signal_weak"] and h["frozen_since"]
    assert {"battery", "frozen", "signal"} <= set(h["issues"])
    # the battery is replaced and the reading moves again: both rows close
    set_state(db, "sensor.fridge_battery", "100")
    run(db, "sensor.fridge_temp", [4.1, 4.2], last + 60)
    assert all(e["ended_at"] for e in events(db, uid) if e["kind"] in ("battery", "frozen"))


def test_health_warnings_can_be_turned_off(app):
    c, db, *_ = app
    add_entity(db, "sensor.fridge_battery", "5", unit="%", device_class="battery")
    device_of(db, "sensor.fridge_temp", "dev-fridge")
    device_of(db, "sensor.fridge_battery", "dev-fridge")
    uid = create(c, door_entity_id=None, rules={"health_warn": False})
    run(db, "sensor.fridge_temp", [4.0, 4.1], T0)
    assert "battery" not in ev_kinds(db, uid) and notes(db, "temperature.health") == []
    assert c.get(f"{API}/{uid}").json()["health"]["battery_low"] is True  # the card still shows it


def test_power_samples_and_duty_insight(app):
    c, db, _s, clk = app
    add_entity(db, "sensor.fridge_plug", "80", unit="W", device_class="power")
    uid = create(c, door_entity_id=None, power_entity_id="sensor.fridge_plug")
    ts = T0
    for i in range(60):
        set_state(db, "sensor.fridge_plug", "80" if i % 2 == 0 else "2")
        set_state(db, "sensor.fridge_temp", "4.0" if i % 3 else "4.2")
        tick(db, ts)
        ts += 60
    with db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM infra_temp_samples WHERE unit_id = ? AND pw IS NOT NULL", (uid,)).fetchone()[0] == 60
        assert rt.run_insights(conn, ts, force=True) == 1
    clk["ts"] = ts
    u = c.get(f"{API}/{uid}").json()
    assert u["insights"]["duty"]["pct_24h"] == 50.0
    assert u["power"]["sensor_name"] == "שם fridge_plug" and u["power"]["on"] is False  # the last reading was 2 W
    bind(c, _s, "vera", "viewer", "installation", "*")
    assert "sensor.fridge_plug" not in c.get(API, headers=as_user("vera")).text  # a friendly name only, never the id


def test_door_insight_marks_a_slow_unit(app):
    c, db, _s, clk = app
    uid = create(c, rules={"recovery_slow_min": 5, "recovery_alert": True})
    ts = T0
    for cycle in range(3):
        for m in range(40):
            door = "on" if m in (5, 6) else "off"
            v = 4.0 if m < 5 else 9.0 if m < 7 else max(4.0, 9.0 - (m - 7) * 0.2)  # back after ~25 minutes
            set_state(db, "binary_sensor.fridge_door", door, dt.datetime.fromtimestamp(ts, UTC).isoformat())
            set_state(db, "sensor.fridge_temp", str(round(v, 2)))
            tick(db, ts)
            ts += 60
    with db.connection() as conn:
        rt.run_insights(conn, ts, force=True)
    tick(db, ts)
    clk["ts"] = ts
    d = c.get(f"{API}/{uid}").json()
    assert d["insights"]["door"]["opens"] == 3 and d["insights"]["door"]["slow"] is True
    assert "recovery" in d["health"]["issues"] and "recovery" in ev_kinds(db, uid)


# ---------------------------------------------------------------- the HACCP daily table

def test_haccp_daily_table(app):
    c, db, _s, clk = app
    uid = create(c, door_entity_id=None)
    day = dt.datetime(2026, 10, 17, 0, 0, tzinfo=TZ).timestamp()
    with db.connection() as conn:
        for m in range(0, 2 * 1440):  # one sample a minute, as the evaluator writes them
            v = 4.0 if m < 1440 else (9.0 if 1440 + 600 <= m < 1440 + 660 else 4.0)  # day 2 has an hour above the band
            t.record_sample(conn, uid, int(day + m * 60), v, 0)
    clk["ts"] = day + 2 * 86400 + 3600
    q = f"units={uid}&range=custom&from={iso(day)}&to={iso(day + 2 * 86400)}"
    r = c.get(f"{API}/report/preview?{q}&layout=haccp")
    assert r.status_code == 200, r.text
    m = r.json()
    rows = m["units"][0]["daily"]
    assert [d["day"] for d in rows] == ["2026-10-17", "2026-10-18"]
    assert rows[0]["verdict"] == "ok" and rows[1]["verdict"] == "exc" and rows[1]["out_min"] >= 55
    assert m["layout"] == "haccp" and m["filename"].startswith("temperature-haccp-")
    from smplwise.services import temperature_report as rep

    html = rep.html_of(m)
    assert "טבלה יומית" in html and "שם המנהל" in html and "דוח תאימות" in html
    assert "daily" not in c.get(f"{API}/report/preview?{q}").json()["units"][0]  # the standard layout has none
    assert c.get(f"{API}/report/preview?{q}&layout=nope").status_code == 422


# ---------------------------------------------------------------- the service ticket from an alarm

@pytest.fixture()
def tickets_on(app):
    c, db, settings, clk = app
    assert c.patch("/api/v1/settings", json={"tickets.enabled": "true"}).status_code == 200
    r = c.put("/api/v1/tickets/admin/departments/dept-maintenance/members/user/dev-joni", json={"role": "manager"})
    assert r.status_code == 200, r.text
    return app


def test_ticket_from_an_alarm_with_chart_and_two_way_link(tickets_on):
    c, db, settings, clk = tickets_on
    uid = create(c, door_entity_id=None, rules={"high_alarm_min": 5})
    last = run(db, "sensor.fridge_temp", [9] * 7, T0)
    clk["ts"] = last
    ev = next(e for e in events(db, uid) if e["kind"] == "high")
    d = c.get(f"{API}/{uid}/ticket/draft?event_id={ev['id']}")
    assert d.status_code == 200, d.text
    draft = d.json()
    assert any(x["id"] == "dept-maintenance" for x in draft["departments"]) and "מקרר מטבח" in draft["title"]
    assert "#/infra/temperature?unit=" in draft["description"] and "sensor.fridge_temp" not in draft["description"]
    r = c.post(f"{API}/{uid}/ticket", json={"department_id": "dept-maintenance", "event_id": ev["id"]})
    assert r.status_code == 201, r.text
    out = r.json()
    assert out["result"] == "created" and out["chart_attached"] is True
    t_detail = c.get(f"/api/v1/tickets/{out['ticket_id']}").json()
    assert t_detail["origin"] == "device" and "#/infra/temperature?unit=" in t_detail["description"]
    with db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM ticket_attachments WHERE ticket_id = ?", (out["ticket_id"],)).fetchone()[0] == 1
        assert conn.execute("SELECT ticket_id FROM infra_temp_events WHERE id = ?", (ev["id"],)).fetchone()[0] == out["ticket_id"]
    u = c.get(f"{API}/{uid}").json()
    assert u["tickets"][0]["number"] == out["number"]
    # a second request for the same row while the ticket is open: absorbed, no second ticket
    r2 = c.post(f"{API}/{uid}/ticket", json={"department_id": "dept-maintenance", "event_id": ev["id"]})
    assert r2.json()["result"] == "absorbed" and r2.json()["ticket_id"] == out["ticket_id"]
    assert sum(1 for e in events(db, uid) if e["kind"] == "ticket") == 2


def test_ticket_needs_the_module_and_the_right(app):
    c, db, settings, _clk = app
    uid = create(c, door_entity_id=None)
    r = c.post(f"{API}/{uid}/ticket", json={"department_id": "dept-maintenance"})
    assert r.status_code == 409 and r.json()["code"] == "tickets_unavailable"
    assert c.patch("/api/v1/settings", json={"tickets.enabled": "true"}).status_code == 200
    bind(c, settings, "vera", "viewer", "installation", "*")
    r = c.post(f"{API}/{uid}/ticket", json={"department_id": "dept-maintenance"}, headers=as_user("vera"))
    assert r.status_code in (403, 422)
    assert c.post(f"{API}/{uid}/ticket", json={"department_id": "dept-maintenance", "event_id": "nope"}).status_code == 404


# ---------------------------------------------------------------- grouping by floor

def test_units_carry_their_floor(app):
    c, db, *_ = app
    with db.connection() as conn:
        conn.execute("INSERT INTO ha_floors(floor_id, name, level, position, updated_at) VALUES ('f1', 'קומה 1', 1, 0, ?)", ("2026-10-19T00:00:00Z",))
        conn.execute("INSERT INTO ha_areas(area_id, name, floor_id, position, updated_at) VALUES ('kitchen', 'מטבח', 'f1', 0, ?)", ("2026-10-19T00:00:00Z",))
    uid = create(c, area_id="kitchen")
    u = next(x for x in c.get(API).json()["units"] if x["id"] == uid)
    assert (u["area_name"], u["floor_name"], u["floor_level"]) == ("מטבח", "קומה 1", 1)


# ---------------------------------------------------------------- the home widget (idea 12) and the new notification sources

def test_home_widget_config_has_the_elevators_shape():
    from smplwise.services import home_config

    cfg = home_config.default_config()
    assert cfg["order"][-5:] == ["temperature", "generators", "doors", "notices", "presence"] and cfg["temperature"]["mode"] == "combined" and cfg["temperature"]["hidden"] == []
    ok = home_config.normalise({"temperature": {"mode": "cards", "hidden": ["u1", "u1"], "filter": "alerts"}})["temperature"]
    assert (ok["mode"], ok["hidden"], ok["filter"]) == ("cards", ["u1"], "alerts")
    for bad in ({"mode": "x"}, {"hidden": ["bad id!"]}, {"filter": "some"}, {"entity": "sensor.x"}):
        with pytest.raises(ValueError):
            home_config.normalise({"temperature": bad})
    p = home_config.normalise_personal({"widgets": {"temperature": {"mode": "both", "hidden": ["u2"]}}})
    out, _d = home_config.apply_personal(home_config.normalise({"temperature": {"hidden": ["u1"]}}), "a", p)
    assert out["temperature"]["mode"] == "both" and out["temperature"]["hidden"] == ["u1", "u2"]  # the user's own list ADDS to the installation's


def test_phase3_notification_sources():
    from smplwise.services import notify_policy

    health, esc = notify_policy.BY_KEY["temperature.health"], notify_policy.BY_KEY["temperature.escalation"]
    assert health.severity == "alert" and esc.severity == "critical"
    assert notify_policy.default_row(health)["recipients"] == {"rule": "temperature"} and notify_policy.default_row(esc)["recipients"] == {"rule": "temperature"}
    assert notify_policy.default_row(esc)["channels"]["app"] is True  # an escalation reaches the phone app like an alarm


# ---------------------------------------------------------------- owner 2026-10-20: the early warning's switch and lead time are settings

def test_early_warning_settings_defaults_and_validation(app):
    c, *_ = app
    s = c.get(f"{API}/settings").json()
    assert s["rules"]["predict_warn"] is False and s["rules"]["predict_warn_min"] == 20  # OFF by default, 20 minutes lead time
    assert s["rule_specs"]["predict_warn_min"] == {"type": "int", "min": 5, "max": 240}
    for bad in (4, 241, 12.5, "20", True):
        r = c.put(f"{API}/settings", json={"rules": {"predict_warn_min": bad}})
        assert r.status_code == 422 and r.json()["code"] == "rule_invalid", bad
        assert c.post(API, json=body(rules={"predict_warn_min": bad})).json()["code"] == "rule_invalid"
    assert c.put(f"{API}/settings", json={"rules": {"predict_warn": True, "predict_warn_min": 45}}).status_code == 200
    s = c.get(f"{API}/settings").json()["rules"]
    assert (s["predict_warn"], s["predict_warn_min"]) == (True, 45)
    uid = create(c, door_entity_id=None, rules={"predict_warn": False, "predict_warn_min": 10})
    m = next(u for u in c.get(f"{API}/manage").json()["units"] if u["id"] == uid)
    assert m["rules"] == {"predict_warn": False, "predict_warn_min": 10}  # a per-unit override of both
    assert c.get(f"{API}/{uid}").json()["rules"]["predict_warn_min"] == 10


@pytest.mark.parametrize("lead,expect", [(10, False), (30, True)])
def test_early_warning_fires_at_the_lead_time(app, lead, expect):
    c, db, *_ = app
    # +0.1 degrees a minute from 3.0: after 10 ticks the reading is 3.9, the crossing of 6 is ~21 minutes away
    uid = create(c, door_entity_id=None, rules={"predict_warn": True, "predict_warn_min": lead})
    run(db, "sensor.fridge_temp", [round(3.0 + 0.1 * i, 2) for i in range(10)], T0)
    assert ("predict" in ev_kinds(db, uid)) is expect
    assert (len(notes(db, "temperature.warning")) == 1) is expect


def test_early_warning_stays_off_by_default_even_with_a_lead_time(app):
    c, db, *_ = app
    uid = create(c, door_entity_id=None, rules={"predict_warn_min": 240})
    run(db, "sensor.fridge_temp", [round(3.0 + 0.1 * i, 2) for i in range(12)], T0)
    assert "predict" not in ev_kinds(db, uid)
