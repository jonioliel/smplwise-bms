"""GENWIDGET 2.9.3: the generator home widget's server side - the `generators` home widget id (appended last, no options of its own,
personal on / off and size like every widget) and the additive fields of GET /generator/devices/live the widget derives mains /
generator from (the roles the live screen's power-flow reads, the mapped role keys, the open critical alerts). A fake controller only."""
from __future__ import annotations

import datetime as dt
import json

import pytest
from fastapi.testclient import TestClient
from generator_world import make_generator, set_state

from smplwise.db import Database
from smplwise.services import generator_alerts as alerts
from smplwise.services import generator_core as core
from smplwise.services import generator_runtime as runtime
from smplwise.services import home_config

API = "/api/v1/generator"
T0 = dt.datetime(2026, 10, 20, 9, 0, tzinfo=dt.timezone.utc).timestamp()


@pytest.fixture()
def app(settings):
    from smplwise.main import create_app
    from smplwise.services import ha_sync

    ha_sync.STATE.connected = False
    alerts.reset()
    runtime.reset()
    c = TestClient(create_app(settings))
    c.get("/api/v1/me")  # joni becomes system_admin (bootstrap)
    return c, Database(settings.db_path)


# ---------------------------------------------------------------- the home widget id

def test_generators_widget_is_appended_last_with_no_options():
    # G2FIX-295: DOORWIN2-295 appended the `doors` widget after it; generators stays right before it, still after every older widget
    assert home_config.WIDGET_IDS[-6:] == ("elevators", "temperature", "generators", "doors", "notices", "presence")
    cfg = home_config.default_config()
    assert cfg["order"][-3:] == ["generators", "doors", "notices", "presence"]
    assert cfg["generators"] == {"on": True, "sizes": {"a": "m", "b": "s", "c": "m"}, "label": "", "phone_on": None, "phone_size": None}
    ok = home_config.normalise({"generators": {"on": False, "sizes": {"a": "l"}, "label": "חשמל חירום", "phone_size": "s"}})["generators"]
    assert (ok["on"], ok["sizes"]["a"], ok["label"], ok["phone_size"]) == (False, "l", "חשמל חירום", "s")
    for bad in ({"mode": "cards"}, {"hidden": []}, {"filter": "all"}, {"sizes": {"a": "xl"}}):
        with pytest.raises(ValueError):
            home_config.normalise({"generators": bad})
    # a stored order from before 2.9.3 keeps its look; the generators widget lands after the older ones (then doors, DOORWIN2-295)
    old = home_config.normalise({"order": ["quick", "clock"]})
    assert old["order"][:2] == ["quick", "clock"] and old["order"][-6:] == ["elevators", "temperature", "generators", "doors", "notices", "presence"]


def test_generators_personal_on_and_size_only():
    p = home_config.normalise_personal({"widgets": {"generators": {"on": False, "size": "l"}}, "order": ["generators"]})
    assert p["widgets"] == {"generators": {"on": False, "size": "l"}} and p["order"][0] == "generators"
    with pytest.raises(ValueError):
        home_config.normalise_personal({"widgets": {"generators": {"mode": "cards"}}})
    out, d = home_config.apply_personal(home_config.default_config(), "a", p)
    assert d == "a" and out["generators"]["on"] is False and out["generators"]["sizes"]["a"] == "l" and out["order"][0] == "generators"


# ---------------------------------------------------------------- GET /generator/devices/live (additive fields)

def test_live_summary_carries_mains_roles_and_critical_count(app):
    c, db = app
    make_generator(db, "full", model="DSE7320")
    with db.connection() as conn:
        core.detect(conn)
    r = c.get(f"{API}/devices/live").json()
    (g,) = r["devices"]
    assert {"engine_state", "mains_available", "ats_position"} <= set(g["roles"]) and not any(x.startswith("alarm_") for x in g["roles"])
    assert g["summary"]["engine_state"]["value"] == "stopped" and g["summary"]["mains_available"]["value"] is True
    assert g["summary"]["ats_position"]["value"] == "mains" and g["open_alerts"] == 0 and g["open_critical"] == 0
    assert "entity_id" not in json.dumps(r) and "sensor." not in json.dumps(r)
    # a non-critical alert (low fuel) counts in open_alerts but not in open_critical
    set_state(db, "sensor.gen_fuel", "18")
    with db.connection() as conn:
        alerts.evaluate(conn, T0)
        alerts.evaluate(conn, T0 + 61)
    g = c.get(f"{API}/devices/live").json()["devices"][0]
    assert g["open_alerts"] == 1 and g["open_critical"] == 0
    # a critical one (emergency stop) counts in both
    set_state(db, "binary_sensor.gen_alarm_emergency", "on")
    with db.connection() as conn:
        alerts.evaluate(conn, T0 + 120)
        alerts.evaluate(conn, T0 + 200)
    g = c.get(f"{API}/devices/live").json()["devices"][0]
    assert g["open_alerts"] == 2 and g["open_critical"] == 1
    # running on the generator after a mains failure: the roles the power-flow reads are in the summary
    set_state(db, "binary_sensor.gen_mains_ok", "off")
    set_state(db, "sensor.gen_engine_state", "Running")
    set_state(db, "select.gen_ats", "Generator")
    g = c.get(f"{API}/devices/live").json()["devices"][0]
    assert (g["summary"]["mains_available"]["value"], g["summary"]["engine_state"]["value"], g["summary"]["ats_position"]["value"]) == (False, "running", "generator")
