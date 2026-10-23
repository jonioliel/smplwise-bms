"""CR-WATER78 slice 2 (leak alerts; owner decisions 2026-10-23): the evaluator's four rules each at its exact threshold (night flow 6 L/h
over 8 consecutive 15-minute buckets inside 01:00-05:00, abnormal = today > 2 x the same-weekday median and > 500 L, burst > the meter's
max_flow_lph, not reporting = 120 min silent AND the entity unavailable), the irrigation default (night rule off, override on), one open
row per meter and kind with one notification that folds / re-notifies as an alarm / resolves, the holds (quiet hours, mute, alerts off:
logged with `suppressed`, an alarm never held by default), acknowledge (water.ack), the permissions and the floor scope on the log and on
the recipients, the module switch (nothing while off, open rows resolved `alerts_disabled`, the sources hidden from the policy matrix),
and restart persistence (the per-meter cursor). Fake mirror states and store samples only; no infrastructure, no device, never an
actuation."""
from __future__ import annotations

import datetime as dt
import json
from zoneinfo import ZoneInfo

import pytest
from conftest import as_user, bind, seed_tree
from fastapi.testclient import TestClient

from smplwise.db import Database
from smplwise.services import energy_store as st
from smplwise.services import ha_scope, ha_sync
from smplwise.services import notify_policy as policies
from smplwise.services import water_alerts as wa
from smplwise.services import water_meters as wm
from smplwise.services import water_runtime as wr
from smplwise.services import water_sampler

API = "/api/v1/infra/water"
TZ = ZoneInfo("Asia/Jerusalem")
W = {"unit_of_measurement": "L", "device_class": "water", "state_class": "total_increasing"}
SENSORS = {f"sensor.water_{k}": (f"מים {k}", "1000", W) for k in ("a", "b", "c", "d", "f2", "f3")}


def seed(settings, states=SENSORS):
    db = Database(settings.db_path)
    with db.connection(durable=False) as conn:
        for eid, (name, state, attrs) in states.items():
            ha_sync.upsert_state(conn, {"entity_id": eid, "state": state, "attributes": {"friendly_name": name, **attrs}})


def set_state(settings, eid: str, state: str):
    name, _s, a = SENSORS[eid]
    seed(settings, {eid: (name, state, a)})


def local(day: int, h: int, m: int = 0, month: int = 10) -> int:
    return int(dt.datetime(2026, month, day, h, m, tzinfo=TZ).timestamp())


@pytest.fixture()
def app(settings, monkeypatch):
    from smplwise.main import create_app

    water_sampler.SAMPLER.shutdown()
    wr.reset()
    c = TestClient(create_app(settings))
    c.get("/api/v1/me")  # joni becomes system_admin (bootstrap)
    seed(settings)
    r = c.put(f"{API}/settings", json={"water.enabled": True})
    assert r.status_code == 200, r.text
    yield c, settings
    water_sampler.SAMPLER.shutdown()
    wr.reset()


def create(c, ref, **kw) -> str:
    r = c.post(f"{API}/meters", json={"source_ref": ref, **kw})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def age(settings, mid: str, iso: str = "2026-08-01T00:00:00Z") -> None:
    with Database(settings.db_path).connection() as conn:
        conn.execute("UPDATE water_meters SET created_at = ? WHERE id = ?", (iso, mid))


def feed(settings, mid: str, start: int, per_bucket_ml: list[int], base_ml: int = 1_000_000, max_flow: float = 20000.0) -> int:
    """A reading at `start` and one at every following 15-minute boundary: bucket k gets exactly per_bucket_ml[k] mL. Returns the last value."""
    store = wm.store_for(settings)
    v = base_ml
    samples = [st.Sample(mid, start, v, max_flow)]
    for k, ml in enumerate(per_bucket_ml):
        v += ml
        samples.append(st.Sample(mid, start + (k + 1) * 900, v, max_flow))
    for s in samples:
        store.apply([s], TZ)
    return v


def run(settings, at: int):
    return wr.tick(Database(settings.db_path), settings, now=at)


def rows(settings, mid: str | None = None, kind: str | None = None):
    with Database(settings.db_path).connection(mode="read") as conn:
        q, a = "SELECT * FROM water_alert_events WHERE 1=1", []
        if mid:
            q += " AND meter_id = ?"
            a.append(mid)
        if kind:
            q += " AND kind = ?"
            a.append(kind)
        return [dict(r) for r in conn.execute(q + " ORDER BY opened_at", a).fetchall()]


def notes(settings, source: str | None = None):
    with Database(settings.db_path).connection(mode="read") as conn:
        q = "SELECT * FROM notifications WHERE subject_kind = 'water'" + (" AND source = ?" if source else "") + " ORDER BY created_at"
        return [dict(r) for r in conn.execute(q, (source,) if source else ()).fetchall()]


def recipients(settings, nid: str) -> set[str]:
    with Database(settings.db_path).connection(mode="read") as conn:
        return {r[0] for r in conn.execute("SELECT user_id FROM notification_recipients WHERE notification_id = ?", (nid,)).fetchall()}


NIGHT = 1500  # mL per 15-minute bucket = exactly 6.0 L/h (the owner's default threshold, Q8)


# ---------------------------------------------------------------- night flow

def test_night_flow_fires_at_exactly_6_lph_over_8_buckets_not_below_and_not_with_7(app):
    c, settings = app
    bind(c, settings, "omer", "operator", "installation", "*")
    bind(c, settings, "dana", "viewer", "installation", "*")
    a, b = create(c, "sensor.water_a"), create(c, "sensor.water_b")
    start = local(20, 1)
    feed(settings, a, start, [NIGHT] * 16)
    feed(settings, b, start, [NIGHT - 1] * 16)  # 5.996 L/h: under the threshold
    assert run(settings, local(20, 2, 47))["opened"] == 0, "seven buckets (1:45) are not two hours"
    out = run(settings, local(20, 3, 2))
    assert out["opened"] == 1 and rows(settings, b) == []
    [ev] = rows(settings, a)
    assert (ev["kind"], ev["severity"], ev["closed_at"], ev["suppressed"]) == ("night_flow", "warning", None, None)
    value = json.loads(ev["value_json"])
    assert value["floor_lph"] == 6.0 and value["run_min"] == 120 and value["threshold_lph"] == 6.0
    [n] = notes(settings)
    assert (n["source"], n["severity"], n["subject_id"], n["state"]) == ("water.leak", "alert", a, "open")  # a leak WARNING = severity alert
    assert "ספיקת לילה 6 ליטר/שעה" in n["body"] and "sensor." not in n["body"]  # the figure, never an entity id
    assert ev["notification_id"] == n["id"]
    # leak recipients: operators and the administrators who may see the meter - not a viewer (no water.view, owner Q4)
    assert {"dev-omer", "dev-joni"} <= recipients(settings, n["id"]) and "dev-dana" not in recipients(settings, n["id"])
    # dedup: more passes keep ONE open row and ONE notification
    run(settings, local(20, 3, 17))
    run(settings, local(20, 3, 32))
    assert len(rows(settings, a)) == 1 and len(notes(settings)) == 1


def test_night_flow_turns_alarm_through_the_whole_window_then_closes_when_the_flow_stops(app):
    c, settings = app
    a = create(c, "sensor.water_a")
    feed(settings, a, local(20, 1), [NIGHT] * 17 + [0, 0])  # 01:00-05:15 flowing, then still
    run(settings, local(20, 3, 2))
    [n0] = notes(settings)
    out = run(settings, local(20, 5, 2))  # due 05:00: all 16 buckets of the window flowed
    assert out["alarmed"] == 1
    [ev] = rows(settings, a)
    assert ev["severity"] == "alarm" and ev["closed_at"] is None
    [n] = notes(settings)
    assert n["id"] == n0["id"] and n["severity"] == "critical" and n["count"] == 2  # one notification, re-notified at critical
    run(settings, local(20, 5, 17))  # 05:00-05:15 still flowing: the alarm stays (it does not end at night_to)
    assert rows(settings, a)[0]["closed_at"] is None
    run(settings, local(20, 5, 32))  # the 05:15 bucket is still: the flow stopped
    [ev] = rows(settings, a)
    assert ev["closed_at"] is not None and ev["close_reason"] == "flow_stopped"
    assert notes(settings)[0]["state"] == "resolved"
    run(settings, local(20, 12, 2))  # later the same day: the same night never opens twice
    assert len(rows(settings, a)) == 1


def test_night_warning_closes_on_a_still_bucket_and_at_night_to(app):
    c, settings = app
    a, b = create(c, "sensor.water_a"), create(c, "sensor.water_b")
    feed(settings, a, local(20, 1), [NIGHT] * 8 + [0] * 8)        # flows two hours, then stops
    feed(settings, b, local(20, 1), [0] * 4 + [NIGHT] * 12)       # a single still bucket earlier resets the run; flows 02:00-05:00
    run(settings, local(20, 3, 2))
    assert rows(settings, b) == [], "the run restarted after the still bucket: 1 hour so far"
    assert rows(settings, a)[0]["closed_at"] is None
    run(settings, local(20, 3, 17))
    assert rows(settings, a)[0]["close_reason"] == "flow_stopped"
    run(settings, local(20, 4, 2))
    assert rows(settings, b)[0]["closed_at"] is None and rows(settings, b)[0]["severity"] == "warning"
    run(settings, local(20, 5, 2))  # not the whole window (it started at 02:00): the warning ends with the window
    assert rows(settings, b)[0]["close_reason"] == "window_ended"


def test_irrigation_meter_has_no_night_rule_by_default_and_an_override_turns_it_on(app):
    c, settings = app
    irr = create(c, "sensor.water_a", kind="irrigation")
    feed(settings, irr, local(20, 1), [NIGHT * 10] * 16)
    run(settings, local(20, 3, 2))
    assert rows(settings, irr) == [], "watering runs at night (owner Q9)"
    m = c.get(f"{API}/meters/{irr}").json()
    assert m["rules"] == {}
    r = c.patch(f"{API}/meters/{irr}", json={"revision": m["revision"], "rules": {"night_rule": True}})
    assert r.status_code == 200 and r.json()["rules"] == {"night_rule": True}
    assert c.patch(f"{API}/meters/{irr}", json={"revision": r.json()["revision"], "rules": {"open_valve": True}}).status_code == 422  # no such rule
    run(settings, local(20, 3, 17))
    assert [e["kind"] for e in rows(settings, irr)] == ["night_flow"]


# ---------------------------------------------------------------- burst

def test_burst_fires_above_max_flow_not_at_it_closes_and_a_restart_does_not_repeat_it(app):
    c, settings = app
    a = create(c, "sensor.water_a", max_flow_lph=100)
    b = create(c, "sensor.water_b", max_flow_lph=100)
    noon = local(20, 12)
    feed(settings, a, noon, [25_000, 25_001, 1000, 1000], max_flow=100)   # 100.0 L/h, then 100.004 L/h
    feed(settings, b, noon, [25_000, 25_000, 1000, 1000], max_flow=100)
    run(settings, local(20, 12, 17))
    assert rows(settings, a) == [] and rows(settings, b) == [], "exactly max_flow_lph is not a burst"
    out = run(settings, local(20, 12, 32))
    [ev] = rows(settings, a)
    assert out["opened"] == 1 and (ev["kind"], ev["severity"]) == ("burst", "alarm") and rows(settings, b) == []
    [n] = notes(settings)
    assert (n["source"], n["severity"]) == ("water.leak", "critical")  # an alarm at once, critical
    # a restart: the janitor's clock is forgotten, a fresh Database; the same bucket is not judged again
    wr.reset()
    run(settings, local(20, 12, 32))
    assert len(rows(settings, a)) == 1 and len(notes(settings)) == 1
    run(settings, local(20, 12, 47))  # the 12:30 bucket is normal again
    [ev] = rows(settings, a)
    assert ev["close_reason"] == "flow_normal" and notes(settings)[0]["state"] == "resolved"
    run(settings, local(20, 13, 2))
    assert len(rows(settings, a)) == 1, "the old burst bucket is behind the cursor: no second row"
    with Database(settings.db_path).connection(mode="read") as conn:
        assert conn.execute("SELECT last_bucket FROM water_alert_state WHERE meter_id = ?", (a,)).fetchone()[0] == local(20, 12, 45)


# ---------------------------------------------------------------- abnormal daily consumption

def _baseline_and_today(settings, mid: str, today_ml: int) -> None:
    """Tuesdays 22.9 / 29.9 / 6.10 / 13.10 used 400 L each (median 400 L); today (Tuesday 20.10) `today_ml` between 00:00 and 12:00."""
    store = wm.store_for(settings)
    v = 1_000_000
    pts = []
    for d, mo in ((22, 9), (29, 9), (6, 10), (13, 10)):
        pts.append((local(d, 0, month=mo), v))
        v += 400_000
        pts.append((local(d + 1, 0, month=mo), v))
    pts.append((local(20, 0), v))
    pts.append((local(20, 12), v + today_ml))
    for ts, val in pts:
        store.apply([st.Sample(mid, ts, val, 20000.0)], TZ)


def test_abnormal_needs_more_than_twice_the_weekday_median_a_baseline_and_a_week_of_age(app):
    c, settings = app
    a = create(c, "sensor.water_a", kind="irrigation")  # irrigation: no night rule in the way (abnormal stays on)
    b = create(c, "sensor.water_b", kind="irrigation")
    young = create(c, "sensor.water_c", kind="irrigation")
    for mid in (a, b):
        age(settings, mid)
    age(settings, young, "2026-10-15T00:00:00Z")
    _baseline_and_today(settings, a, 800_000)       # exactly 2 x 400 L: not abnormal
    _baseline_and_today(settings, b, 800_001)
    _baseline_and_today(settings, young, 900_000)
    run(settings, local(20, 12, 2))
    assert rows(settings, a) == [] and rows(settings, young) == [], "the factor is strict; a meter younger than 7 days has no baseline"
    [ev] = rows(settings, b)
    v = json.loads(ev["value_json"])
    assert (ev["kind"], ev["severity"]) == ("abnormal", "warning") and v["median_ml"] == 400_000 and v["today_ml"] == 800_001 and v["baseline_n"] == 4
    [n] = notes(settings)
    assert (n["source"], n["severity"]) == ("water.abnormal", "alert")
    item = c.get(f"{API}/events").json()["items"][0]
    assert item["value"]["today_l"] == 800.001 and item["value"]["median_l"] == 400.0 and "today_ml" not in item["value"]
    # the next day the condition ends (today starts again)
    run(settings, local(21, 0, 17))
    assert rows(settings, b)[0]["closed_at"] is not None


def test_abnormal_minimum_litres_and_no_baseline_no_rule(app):
    c, settings = app
    a = create(c, "sensor.water_a", kind="irrigation")
    none = create(c, "sensor.water_b", kind="irrigation")
    age(settings, a)
    age(settings, none)
    store = wm.store_for(settings)
    # baseline Tuesdays at 100 L (2 x = 200 L), today 500 L: above twice the median but NOT above abnormal_min_l (500 L)
    v = 1_000_000
    for d, mo in ((22, 9), (29, 9), (6, 10), (13, 10)):
        store.apply([st.Sample(a, local(d, 0, month=mo), v, 20000.0)], TZ)
        v += 100_000
        store.apply([st.Sample(a, local(d + 1, 0, month=mo), v, 20000.0)], TZ)
    store.apply([st.Sample(a, local(20, 0), v, 20000.0)], TZ)
    store.apply([st.Sample(a, local(20, 12), v + 500_000, 20000.0)], TZ)
    feed(settings, none, local(20, 0), [100_000] * 48)  # no history at all: no baseline, no rule
    run(settings, local(20, 12, 2))
    assert rows(settings, a) == [] and rows(settings, none) == []


# ---------------------------------------------------------------- not reporting

def test_offline_needs_the_silence_and_an_unavailable_entity(app):
    c, settings = app
    down, still = create(c, "sensor.water_a"), create(c, "sensor.water_b")
    t = local(20, 12)
    for mid in (down, still):
        wm.store_for(settings).apply([st.Sample(mid, t, 1_000_000, 20000.0)], TZ)
    set_state(settings, "sensor.water_a", "unavailable")
    run(settings, t + 119 * 60)
    assert rows(settings, down, "offline") == []
    run(settings, t + 120 * 60)
    [ev] = rows(settings, down, "offline")
    assert ev["severity"] == "warning" and json.loads(ev["value_json"])["silent_min"] == 120
    run(settings, t + 300 * 60)
    assert rows(settings, still, "offline") == [], "a silent but available meter is not offline (water is often still)"
    [n] = notes(settings, "water.offline")
    assert n["severity"] == "alert"
    set_state(settings, "sensor.water_a", "1000")
    wm.store_for(settings).apply([st.Sample(down, t + 301 * 60, 1_000_000, 20000.0)], TZ)
    run(settings, t + 302 * 60)
    assert rows(settings, down, "offline")[0]["close_reason"] == "reporting" and notes(settings, "water.offline")[0]["state"] == "resolved"


# ---------------------------------------------------------------- holds

def test_quiet_hours_and_mute_hold_warnings_only_and_alerts_off_logs_without_sending(app, monkeypatch):
    c, settings = app
    r = c.put(f"{API}/alerts", json={"rules": {"quiet_enabled": True, "quiet_from": "00:00", "quiet_to": "06:00"}})
    assert r.status_code == 200, r.text
    warn = create(c, "sensor.water_a")
    burst = create(c, "sensor.water_b", max_flow_lph=100)
    feed(settings, warn, local(20, 1), [NIGHT] * 12)
    feed(settings, burst, local(20, 1), [0] * 7 + [30_000], max_flow=100)
    run(settings, local(20, 3, 2))
    w = rows(settings, warn)[0]
    assert w["suppressed"] == "quiet" and w["notification_id"] is None, "a held warning is logged, not sent"
    bst = rows(settings, burst, "burst")[0]
    assert bst["suppressed"] is None and bst["notification_id"], "an alarm is never held by the quiet hours by default"
    assert [n["source"] for n in notes(settings)] == ["water.leak"]
    # quiet hours off -> the held warning goes out on the next pass while the condition still holds
    c.put(f"{API}/alerts", json={"rules": {"quiet_enabled": False}})
    # a mute (water.ack) holds it instead
    monkeypatch.setattr(wr, "clock", lambda: float(local(20, 3, 10)))
    assert c.post(f"{API}/meters/{warn}/mute", json={"minutes": 30}).status_code == 200
    assert c.post(f"{API}/meters/{warn}/mute", json={"minutes": 45}).status_code == 422  # 15 / 30 / 60 / 120 only
    run(settings, local(20, 3, 17))
    assert rows(settings, warn)[0]["suppressed"] == "mute"
    assert c.delete(f"{API}/meters/{warn}/mute").status_code == 200
    run(settings, local(20, 3, 32))
    w = rows(settings, warn)[0]
    assert w["suppressed"] is None and w["notification_id"] and len(notes(settings)) == 2
    # alerts off: a new row is logged with `off` and nothing is sent
    c.put(f"{API}/alerts", json={"rules": {"alerts_enabled": False}})
    other = create(c, "sensor.water_c")
    feed(settings, other, local(20, 1), [NIGHT] * 12)
    run(settings, local(20, 3, 47))
    o = rows(settings, other)[0]
    assert o["suppressed"] == "off" and o["notification_id"] is None and len(notes(settings)) == 2


# ---------------------------------------------------------------- acknowledge, permissions, floor scope

def test_ack_needs_water_ack_once_and_acknowledges_the_notification(app):
    c, settings = app
    bind(c, settings, "omer", "operator", "installation", "*")
    bind(c, settings, "dana", "viewer", "installation", "*")
    a = create(c, "sensor.water_a")
    feed(settings, a, local(20, 1), [NIGHT] * 12)
    run(settings, local(20, 3, 2))
    eid = rows(settings, a)[0]["id"]
    assert c.get(f"{API}/events", headers=as_user("dana")).status_code == 403  # viewers: no water.view (Q4)
    assert c.post(f"{API}/events/{eid}/ack", headers=as_user("dana")).status_code == 403
    listed = c.get(f"{API}/events", headers=as_user("omer")).json()
    assert [i["id"] for i in listed["items"]] == [eid] and listed["items"][0]["can_ack"] is True
    assert (listed["summary"]["open"], listed["summary"]["acked"], listed["summary"]["open_leaks"]) == (1, 0, 1)
    r = c.post(f"{API}/events/{eid}/ack", headers=as_user("omer"))
    assert r.status_code == 200 and r.json()["ack_at"] and r.json()["can_ack"] is False
    assert c.post(f"{API}/events/{eid}/ack", headers=as_user("omer")).json()["code"] == "already_acked"
    assert notes(settings)[0]["state"] == "acknowledged"
    assert rows(settings, a)[0]["closed_at"] is None, "acknowledging does not end the condition"
    with Database(settings.db_path).connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'infra.water.event.ack' AND decision = 'allowed'").fetchone()[0] == 1
    assert c.post(f"{API}/events/nope/ack", headers=as_user("omer")).status_code == 404
    # the rules and the routing: water.manage reads, system.configure writes
    bind(c, settings, "sara", "site_admin", "installation", "*")
    assert c.get(f"{API}/alerts", headers=as_user("omer")).status_code == 403
    got = c.get(f"{API}/alerts", headers=as_user("sara")).json()
    assert got["rules"]["night_from"] == "01:00" and got["rules"]["night_to"] == "05:00" and got["rules"]["night_min_lph"] == 6.0
    assert got["rules"]["night_min_intervals"] == 8 and got["rules"]["alerts_enabled"] is True and got["can_edit"] is False
    assert got["kinds"]["leak"]["recipients"]["roles"] == ["operator", "site_admin", "system_admin"]
    assert c.put(f"{API}/alerts", headers=as_user("sara"), json={"rules": {"night_min_lph": 3}}).status_code == 403
    assert c.put(f"{API}/alerts", json={"rules": {"night_from": "01:00", "night_to": "01:00"}}).status_code == 422


def test_floor_scope_on_the_log_the_ack_and_the_recipients(app, monkeypatch):
    c, settings = app
    ids = seed_tree(c)
    f2, f3 = create(c, "sensor.water_f2"), create(c, "sensor.water_f3")
    placed = {"sensor.water_f2": [{"floor_id": ids["floor2"], "floor_name": "קומה 2"}], "sensor.water_f3": [{"floor_id": ids["floor3"], "floor_name": "קומה 3"}]}
    monkeypatch.setattr(ha_scope, "placements", lambda conn: placed)
    bind(c, settings, "flo", "operator", "floor", ids["floor2"])
    for mid in (f2, f3):
        feed(settings, mid, local(20, 1), [NIGHT] * 12)
    run(settings, local(20, 3, 2))
    e3 = rows(settings, f3)[0]
    got = c.get(f"{API}/events", headers=as_user("flo")).json()
    assert [i["meter_id"] for i in got["items"]] == [f2] and got["summary"]["open"] == 1
    assert c.post(f"{API}/events/{e3['id']}/ack", headers=as_user("flo")).status_code == 404  # invisible = missing
    assert c.get(f"{API}/events", headers=as_user("flo"), params={"meter_id": f3}).status_code == 404
    # the notification of the floor-3 meter never reached the floor-2 operator; the floor-2 one did
    assert "dev-flo" not in recipients(settings, e3["notification_id"])
    assert "dev-flo" in recipients(settings, rows(settings, f2)[0]["notification_id"])
    assert c.post(f"{API}/events/{rows(settings, f2)[0]['id']}/ack", headers=as_user("flo")).status_code == 200


# ---------------------------------------------------------------- the module switch

def test_module_off_evaluates_nothing_resolves_open_rows_and_hides_the_sources(app):
    c, settings = app
    a = create(c, "sensor.water_a")
    feed(settings, a, local(20, 1), [NIGHT] * 12)
    with Database(settings.db_path).connection() as conn:
        assert {p["source"] for p in policies.list_policies(conn)} >= {"water.leak", "water.abnormal", "water.offline"}
    run(settings, local(20, 3, 2))
    assert c.get(f"{API}/events/summary").json()["home_tile"] == {"show": True, "leaks": 1, "link": "#/infra/water/alerts"}
    assert c.put(f"{API}/settings", json={"water.enabled": False}).status_code == 200
    [ev] = rows(settings, a)
    assert ev["close_reason"] == "alerts_disabled"
    [n] = notes(settings)
    assert n["state"] == "resolved" and n["resolution"] == "alerts_disabled"
    assert run(settings, local(20, 3, 17)) == {"skipped": "module_off"}
    assert wr.janitor(Database(settings.db_path), settings, now=local(20, 3, 47)) == {"skipped": "module_off"}
    assert len(rows(settings, a)) == 1
    for method, url in (("get", "/events"), ("get", "/events/summary"), ("post", f"/events/{ev['id']}/ack"), ("get", "/alerts"), ("post", f"/meters/{a}/mute")):
        r = getattr(c, method)(API + url, **({"json": {"minutes": 15}} if method == "post" else {}))
        assert r.status_code == 404 and r.json()["code"] == "module_off", url
    with Database(settings.db_path).connection() as conn:
        listed = {p["source"] for p in policies.list_policies(conn)}
    assert not {s for s in listed if s.startswith("water.")}, "the water sources are not offered while the module is off"


def test_home_tile_only_while_a_leak_is_open_and_the_setting_is_on(app):
    c, settings = app
    assert c.get(f"{API}/events/summary").json()["home_tile"]["show"] is False
    a = create(c, "sensor.water_a")
    feed(settings, a, local(20, 1), [NIGHT] * 12)
    run(settings, local(20, 3, 2))
    assert c.get(f"{API}/events/summary").json()["home_tile"]["show"] is True
    assert c.put(f"{API}/settings", json={"water.home_kpi": False}).status_code == 200
    assert c.get(f"{API}/events/summary").json()["home_tile"]["show"] is False


# ---------------------------------------------------------------- restart persistence, janitor cadence, catalogue

def test_restart_keeps_the_open_row_the_notification_and_the_mute(app, monkeypatch):
    c, settings = app
    a = create(c, "sensor.water_a")
    feed(settings, a, local(20, 1), [NIGHT] * 12)
    db = Database(settings.db_path)
    assert wr.janitor(db, settings, now=local(20, 3, 2))["opened"] == 1
    assert wr.janitor(db, settings, now=local(20, 3, 10)) is None, "one pass per closed bucket"
    monkeypatch.setattr(wr, "clock", lambda: float(local(20, 3, 5)))
    c.post(f"{API}/meters/{a}/mute", json={"minutes": 120})
    wr.reset()  # a process restart
    out = wr.janitor(Database(settings.db_path), settings, now=local(20, 3, 17))
    assert out["opened"] == 0 and out["notified"] == 0
    [ev] = rows(settings, a)
    assert ev["closed_at"] is None and len(notes(settings)) == 1
    with Database(settings.db_path).connection(mode="read") as conn:
        assert conn.execute("SELECT muted_until FROM water_meters WHERE id = ?", (a,)).fetchone()[0]


def test_catalogue_rule_and_subject_registered_and_no_device_action():
    for key, sev in (("water.leak", "critical"), ("water.abnormal", "alert"), ("water.offline", "alert")):
        s = policies.BY_KEY[key]
        assert (s.who, s.subject, s.severity, s.category) == ("water", "water", sev, "device_faults")
    assert "water" in policies.RECIPIENT_RULES and "water" in policies.SUBJECT_KINDS
    assert policies.BY_KEY["water.leak"].app and policies.BY_KEY["water.leak"].push and not policies.BY_KEY["water.offline"].push
    assert wa.RULE_DEFAULTS["night_from"] == "01:00" and wa.RULE_DEFAULTS["night_min_lph"] == 6.0 and wa.RULE_DEFAULTS["night_min_intervals"] == 8
    import inspect

    src = inspect.getsource(wr) + inspect.getsource(wa)
    for word in ("call_service", "turn_off", "valve", "ha_client"):
        assert word not in src.replace("no valve", ""), word  # the evaluator never acts on a device (owner Q6)
