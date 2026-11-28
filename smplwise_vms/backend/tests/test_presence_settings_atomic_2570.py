# ruff: noqa: F811
"""FIX-UTIL-B-2570 (review CU2-09, CU2-10): the presence settings save is all or nothing, audited, and never leaves a policy that locks
every in-scope user out (a REQUIRED sensor that is not on the approved list)."""
from __future__ import annotations

import json

from test_presence import API, _limits, world  # noqa: F401 - fixtures shared with the presence suite


def _put(c, **body):
    return c.put(f"{API}/presence/settings", json=body)


def _settings(c):
    return c.get(f"{API}/presence/settings").json()["settings"]


def test_a_required_sensor_that_is_not_approved_is_refused_by_the_server(world):
    _app, c, _ids = world
    r = _put(c, sensors_allowed=["location", "battery"], required_sensors={"enabled": True, "sensors": ["location", "beacon"]})
    assert r.status_code == 422, r.text
    body = r.json()
    assert body["details"]["fields"] == ["required_sensors.sensors"] or "required_sensors.sensors" in json.dumps(body)
    assert "beacon" in json.dumps(body, ensure_ascii=False)
    assert _settings(c)["required_sensors"]["enabled"] is False  # nothing stored


def test_unticking_an_approved_sensor_that_the_stored_policy_requires_is_refused(world):
    _app, c, _ids = world
    assert _put(c, required_sensors={"enabled": True, "sensors": ["location", "beacon"]}).status_code == 200
    r = _put(c, sensors_allowed=["location", "battery"])  # the policy is not in the body: it is judged as stored
    assert r.status_code == 422, r.text
    assert "beacon" in _settings(c)["sensors_allowed"]
    # a disabled policy does not hold the list hostage, and a consistent save passes
    assert _put(c, required_sensors={"enabled": False, "sensors": ["beacon"]}).status_code == 200
    assert _put(c, sensors_allowed=["location", "battery"]).status_code == 200


def test_a_failed_save_leaves_nothing_half_saved_and_the_refusal_is_audited(world):
    app, c, _ids = world
    before = _settings(c)
    r = _put(c, enabled=True, retention_days=90, notice_text="x" * 9000)  # `enabled` and `retention_days` are written before the notice is judged
    assert r.status_code == 422, r.text
    after = _settings(c)
    assert after["enabled"] is before["enabled"] is False
    assert after["retention_days"] == before["retention_days"]
    with app.state.db.connection(mode="read") as conn:
        rows = conn.execute("SELECT decision, reason FROM audit_log WHERE action = 'presence.settings.update' ORDER BY id DESC").fetchall()
    assert rows and rows[0]["decision"] == "denied" and rows[0]["reason"]


def test_a_later_bad_field_after_enabled_also_rolls_back(world):
    _app, c, _ids = world
    r = _put(c, enabled=True, wifi_match_mode="nonsense")
    assert r.status_code == 422, r.text
    assert _settings(c)["enabled"] is False
    ok = _put(c, enabled=True, retention_days=45)
    assert ok.status_code == 200 and ok.json()["settings"]["enabled"] is True and ok.json()["settings"]["retention_days"] == 45
