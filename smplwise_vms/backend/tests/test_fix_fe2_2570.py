"""FIX-FE2-2570 (deep review 2.57 FRONTEND-CORE, second pass): the two additive fields the screens needed.

- FE2-06: GET presence/building and GET presence/area/{id} carry the installation's IANA zone (`time_zone`, the stored `time.zone`),
  so "empty since HH:MM" is shown in the installation's zone, not on a fixed Israel clock.
- FE2-13: GET ha/status `bridge.integration_version` = the version the bridge itself reported (stored as the setting
  `bridge.integration_version`, never sent before), so the support card does not say "unknown" for a bridge installed by hand.
Synthetic data only."""
from __future__ import annotations

from fastapi.testclient import TestClient

from smplwise.db import set_setting
from smplwise.main import create_app

API = "/api/v1"


def _app(settings):
    app = create_app(settings)
    return app, TestClient(app)


def test_presence_answers_carry_the_installation_zone(settings):
    app, c = _app(settings)
    r = c.get(f"{API}/presence/building")
    assert r.status_code == 200, r.text
    assert r.json()["time_zone"] == "Asia/Jerusalem"  # the default while nothing is stored
    with app.state.db.connection() as conn:
        set_setting(conn, "time.zone", "America/New_York")
    assert c.get(f"{API}/presence/building").json()["time_zone"] == "America/New_York"
    a = c.get(f"{API}/presence/area/a_lobby")
    assert a.status_code == 200, a.text
    assert a.json()["time_zone"] == "America/New_York"


def test_ha_status_sends_the_bridge_reported_version(settings):
    app, c = _app(settings)
    st = c.get(f"{API}/ha/status").json()
    assert st["bridge"]["integration_version"] is None  # never reported: unknown, not invented
    with app.state.db.connection() as conn:
        set_setting(conn, "bridge.integration_version", "0.10.10")
    assert c.get(f"{API}/ha/status").json()["bridge"]["integration_version"] == "0.10.10"
