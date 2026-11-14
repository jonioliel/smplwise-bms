"""TEMPEXPLAIN093-295 (board row r093): "why did the fridge warm at 03:00?" - the rule-based explanation of an excursion from the stored
signals (door, defrost, mains outage, compressor power, data gaps, spikes, neighbouring units, maintenance, a climate unit's mode /
setpoint). No external model. Pure core on synthetic series first, then the route on a fake mirror with a fake clock (no Home Assistant)."""
from __future__ import annotations

import pytest
from conftest import as_user, bind
from test_infra_temperature import API, T0, app, create, events, iso, set_state, tick  # noqa: F401 - `app` is the fixture

from smplwise.services import temperature as t
from smplwise.services import temperature_explain as tx

RULES = t.code_defaults()
S = T0 + 3 * 3600  # the excursion starts here


def flat(v: float, lo: float, hi: float, *, pw: float | None = None, flags: int = 0, sp: float | None = None):
    return [(float(ts), v, flags, sp, pw) for ts in range(int(lo), int(hi), 60)]


def run_explain(points, *, kind="high", end=S + 600, peak=8.0, doors=None, defrost=(), outages=(), maint=(), offline=(), neighbors=(), has_power=False, **rules):
    return tx.explain(kind=kind, start_ts=S, end_ts=end, now_ts=S + 7200, peak=peak, low=2.0, high=6.0, hard_max=11.0, points=points, doors=doors,
                      defrost=list(defrost), outages=list(outages), maint=list(maint), offline=list(offline), neighbors=list(neighbors),
                      has_power=has_power, rules={**RULES, **rules})


def warming():
    """4.0 until S, then 8.0 for ten minutes, back to 4.0."""
    return flat(4.0, S - 7200, S) + flat(8.0, S, S + 600) + flat(4.0, S + 600, S + 3600)


def keys(out):
    return [f["key"] for f in out["factors"]]


# ---------------------------------------------------------------- pure

def test_door_opened_before_the_start_is_the_primary_cause():
    out = run_explain(warming(), doors=[(S - 8 * 60, S - 2 * 60)])
    assert out["primary"] == "door" and out["confidence"] == "high"
    f = out["factors"][0]
    assert f["vars"]["count"] == 1 and f["vars"]["total_min"] == 6.0 and f["vars"]["lead_min"] == 8 and f["vars"]["open_at_start"] is False


def test_a_short_door_opening_is_below_the_minimum():
    out = run_explain(warming(), doors=[(S - 60, S - 40)], explain_door_min_open_min=2)
    assert "door" not in keys(out)
    out = run_explain(warming(), doors=[(S - 60, S - 40)], explain_door_min_open_min=0)  # 0 = half a minute
    assert "door" not in keys(out)  # 20 s
    assert "door" in keys(run_explain(warming(), doors=[(S - 60, S)], explain_door_min_open_min=0))


def test_door_not_visible_is_never_named():
    assert "door" not in keys(run_explain(warming(), doors=None))


def test_defrost_window_short_and_below_the_hard_max():
    out = run_explain(warming(), defrost=[(S - 300, S + 1500)])
    assert out["primary"] == "defrost" and out["factors"][0]["score"] == 85 and out["factors"][0]["vars"]["window_minutes"] == 30
    hot = run_explain(warming(), defrost=[(S - 300, S + 1500)], peak=12.0)
    assert next(f for f in hot["factors"] if f["key"] == "defrost")["score"] == 55 and hot["factors"][0]["vars"].get("above_hard_max") in (True, None)


def test_mains_outage_from_the_generator_module():
    out = run_explain(warming(), outages=[{"from_ts": S - 1800, "to_ts": S + 300, "device_name": "גנרטור ראשי"}])
    assert out["primary"] == "outage" and out["factors"][0]["vars"]["lead_min"] == 30 and out["factors"][0]["vars"]["device_name"] == "גנרטור ראשי"
    far = run_explain(warming(), outages=[{"from_ts": S - 5 * 3600, "to_ts": S - 4 * 3600}])  # beyond the 120 minute lookback
    assert "outage" not in keys(far)


def test_compressor_stopped_and_power_sensor_silent():
    pts = flat(4.0, S - 7200, S - 2400, pw=90.0) + flat(4.5, S - 2400, S, pw=0.0) + flat(8.0, S, S + 600, pw=0.0)
    out = run_explain(pts, has_power=True)
    assert out["primary"] == "compressor_off" and out["factors"][0]["vars"]["minutes"] >= 20
    silent = run_explain(warming(), has_power=True)
    assert "compressor_no_power" in keys(silent)
    assert "compressor_off" not in keys(run_explain(pts, has_power=False))


def test_a_low_excursion_ignores_the_door_and_reads_a_compressor_that_never_stops():
    pts = flat(3.0, S - 7200, S, pw=120.0) + flat(1.0, S, S + 600, pw=120.0)
    out = run_explain(pts, kind="low", peak=1.0, doors=[(S - 300, S)], has_power=True, explain_lookback_min=120, explain_compressor_off_min=20)
    assert "door" not in keys(out) and out["primary"] == "compressor_on"


def test_spike_gap_and_silent_sensor():
    spike = flat(4.0, S - 7200, S) + [(float(S), 9.5, 0, None, None)] + flat(4.0, S + 60, S + 3600)
    out = run_explain(spike, end=S + 60, peak=9.5)
    assert out["primary"] == "spike" and out["factors"][0]["vars"]["jump"] == 5.5
    gap = flat(4.0, S - 7200, S - 1500) + flat(8.0, S, S + 600)
    g = next(f for f in run_explain(gap)["factors"] if f["key"] == "gap")
    assert g["vars"]["gap_min"] == 26 and g["vars"]["silent"] is False  # the last reading at S - 26 min
    assert next(f for f in run_explain(warming(), offline=[(S - 900, S - 600)])["factors"] if f["key"] == "gap")["vars"]["silent"] is True


def test_neighbours_shared_or_local():
    nb_warm = {"name": "מקרר משקאות", "points": [(ts, v) for ts, v, *_ in warming()]}
    nb_cold = {"name": "מקפיא", "points": [(ts, -18.0) for ts, *_ in warming()]}
    shared = run_explain(warming(), neighbors=[nb_warm, {**nb_warm, "name": "ויטרינה"}])
    f = next(x for x in shared["factors"] if x["key"] == "shared")
    assert f["score"] == 80 and f["vars"]["n_moved"] == 2 and f["vars"]["names"] == ["מקרר משקאות", "ויטרינה"]
    local = run_explain(warming(), neighbors=[nb_cold])
    assert "local" in keys(local) and local["primary"] != "local"  # informational, never the cause
    half = run_explain(warming(), neighbors=[nb_warm, nb_cold])
    assert "shared" in keys(half)


def test_maintenance_climate_off_and_setpoint():
    out = run_explain(warming(), maint=[(S - 600, S + 1800, "ניקוי")])
    assert out["factors"][0]["key"] == "maint" and out["factors"][0]["vars"]["reason"] == "ניקוי"
    off = flat(4.0, S - 7200, S - 900) + flat(5.0, S - 900, S, flags=4) + flat(8.0, S, S + 600)
    assert run_explain(off)["primary"] == "unit_off"
    sp = flat(4.0, S - 7200, S - 1200, sp=4.0) + flat(5.0, S - 1200, S, sp=7.0) + flat(8.0, S, S + 600, sp=7.0)
    f = next(x for x in run_explain(sp)["factors"] if x["key"] == "setpoint")
    assert f["vars"] == {"sp_from": 4.0, "sp_to": 7.0}


def test_gradual_rise_is_the_last_explanation_and_the_minimum_score_filters():
    pts = [(float(ts), 3.0 + (ts - (S - 7200)) / 3600 * 1.5, 0, None, None) for ts in range(int(S - 7200), int(S + 600), 60)]
    out = run_explain(pts, end=None, peak=6.2)
    assert out["primary"] == "gradual" and out["confidence"] == "low" and out["profile"]["ongoing"] is True
    assert run_explain(pts, end=None, peak=6.2, explain_min_score=50)["confidence"] == "none"
    only_maint = run_explain(warming(), maint=[(S - 600, S + 1800, None)], doors=[(S - 480, S - 300)], explain_min_score=90)
    assert keys(only_maint) == ["maint"]


def test_nothing_found():
    out = run_explain(warming())
    assert out["factors"] == [] and out["primary"] is None and out["confidence"] == "none"


def test_new_settings_are_validated():
    for bad in ({"explain_lookback_min": 5}, {"explain_neighbor_scope": "floor"}, {"explain_spike_jump": 0.1}, {"explain_enabled": "yes"}):
        with pytest.raises(t.Invalid):
            t.validate_rules(bad, installation=True)
    with pytest.raises(t.Invalid):
        t.validate_rules({"explain_lookback_min": 60})  # installation-only, never per unit
    assert t.validate_rules({"explain_neighbor_scope": "all", "explain_door_min_open_min": 0}, installation=True) == {"explain_neighbor_scope": "all", "explain_door_min_open_min": 0}


# ---------------------------------------------------------------- the route on a fake mirror

def _series(db, clock, uid_door: str = "binary_sensor.fridge_door"):
    """70 quiet minutes at 4 degrees, the door open from minute 62 to 68, the reading at 8 from minute 66 to 80, back to 4."""
    ts = T0
    for m in range(0, 95):
        set_state(db, uid_door, "on" if 62 <= m < 68 else "off", changed=iso(ts))
        set_state(db, "sensor.fridge_temp", "8.0" if 66 <= m < 80 else "4.0")
        set_state(db, "sensor.freezer_temp", "-18.0")
        tick(db, ts)
        ts += 60
    clock["ts"] = ts


def test_route_explains_an_event_and_a_moment(app):
    c, db, settings, clock = app
    uid = create(c)
    create(c, name="מקפיא", temp_entity_id="sensor.freezer_temp", door_entity_id=None, low=-22, high=-16)
    _series(db, clock)
    ev = next(e for e in events(db, uid) if e["kind"] == "high")
    r = c.get(f"{API}/{uid}/explain?event_id={ev['id']}")
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["primary"] == "door" and out["event_id"] == ev["id"] and out["kind"] == "high"
    assert "local" in [f["key"] for f in out["factors"]]  # the freezer did not move
    assert "sensor." not in r.text and "binary_sensor." not in r.text  # friendly names only, never an entity id
    at = c.get(f"{API}/{uid}/explain", params={"at": iso(T0 + 70 * 60)})
    assert at.status_code == 200 and at.json()["event_id"] == ev["id"]
    assert c.get(f"{API}/{uid}/explain").status_code == 422
    assert c.get(f"{API}/{uid}/explain", params={"at": iso(clock["ts"] + 3600)}).status_code == 422  # the future
    assert c.get(f"{API}/{uid}/explain?event_id=nope").json()["code"] == "event_not_found"
    assert c.get(f"{API}/nope/explain?event_id={ev['id']}").json()["code"] == "unit_not_found"
    assert c.get(API).json()["explain"] is True
    # turned off in the settings: the route answers 409 and the list says so
    assert c.put(f"{API}/settings", json={"rules": {"explain_enabled": False}}).status_code == 200
    assert c.get(f"{API}/{uid}/explain?event_id={ev['id']}").json()["code"] == "explain_off"
    assert c.get(API).json()["explain"] is False


def test_route_reads_a_mains_outage_of_the_generator_module(app):
    c, db, settings, clock = app
    uid = create(c, door_entity_id=None)
    _series(db, clock)
    with db.connection() as conn:
        conn.execute("""INSERT INTO generator_devices(id, name, source_kind, source_device_ref, status, detected_at) VALUES ('g1', 'גנרטור ראשי', 'manual', 'dev1', 'detected', ?)""", (iso(T0),))
        conn.execute("""INSERT INTO generator_alerts(id, device_id, alert_key, severity, raised_at, cleared_at, last_at) VALUES ('a1', 'g1', 'mains_lost', 'alert', ?, ?, ?)""",
                     (iso(T0 + 40 * 60), iso(T0 + 70 * 60), iso(T0 + 70 * 60)))
    ev = next(e for e in events(db, uid) if e["kind"] == "high")
    out = c.get(f"{API}/{uid}/explain?event_id={ev['id']}").json()
    assert out["primary"] == "outage" and out["factors"][0]["vars"]["device_name"] == "גנרטור ראשי"


def test_route_respects_the_unit_scope(app):
    c, db, settings, clock = app
    uid = create(c)
    _series(db, clock)
    ev = next(e for e in events(db, uid) if e["kind"] == "high")
    bind(c, settings, "vera", "viewer", "installation", "*")
    bind(c, settings, "kio", "kiosk", "installation", "*")
    r = c.get(f"{API}/{uid}/explain?event_id={ev['id']}", headers=as_user("vera"))  # a viewer reads it (devices.read), without entity ids
    assert r.status_code == 200 and "sensor.fridge_temp" not in r.text and "binary_sensor.fridge_door" not in r.text
    assert c.get(f"{API}/{uid}/explain?event_id={ev['id']}", headers=as_user("kio")).status_code == 403
