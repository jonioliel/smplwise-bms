"""HA state history on the map (T041): every state the VMS learns of is recorded once; the map at an instant says
known / unknown per entity from the local history only — unknown before the history began, unknown when the last
confirmation is older than the forward-fill bound and nothing later bounds it, known when a later change bounds
the state; a timezone change never alters the instant; old rows age out."""
from __future__ import annotations

import datetime as dt

from conftest import png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import ha_history, ha_sync


def _st(entity_id: str, state: str, last_changed: str, **attrs):
    return {"entity_id": entity_id, "state": state, "last_changed": last_changed, "last_updated": last_changed, "attributes": attrs}


def test_record_state_at_and_prune(settings):
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    floor = ids["floor2"]
    asset = c.post(f"/api/v1/floors/{floor}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
    v = c.post(f"/api/v1/floors/{floor}/plan-versions", json={"asset_id": asset["id"]}).json()
    c.post(f"/api/v1/plan-versions/{v['id']}/publish")
    now = dt.datetime.now(dt.timezone.utc)
    iso = lambda d: d.strftime("%Y-%m-%dT%H:%M:%SZ")  # noqa: E731
    with app.state.db.connection() as conn:
        # the snapshot at connect: a door that changed 3 days ago, a lock that changed an hour ago
        ha_sync.upsert_state(conn, _st("binary_sensor.door", "off", iso(now - dt.timedelta(days=3)), device_class="door", friendly_name="דלת"))
        ha_sync.upsert_state(conn, _st("lock.front", "locked", iso(now - dt.timedelta(hours=1)), friendly_name="מנעול"))
        assert ha_history.record(conn, _st("lock.front", "locked", iso(now - dt.timedelta(hours=1)))) is False, "same change twice is one row"
        cov = ha_history.coverage(conn)
        assert cov["rows"] == 2 and cov["from"] and cov["retention_days"] == 30
        # rewrite the receipt times so the test controls the timeline: history began 2 hours ago
        conn.execute("UPDATE ha_state_history SET recorded_at = ?", (iso(now - dt.timedelta(hours=2)),))
        # the door opens 30 minutes ago and closes 10 minutes ago
        ha_sync.upsert_state(conn, _st("binary_sensor.door", "on", iso(now - dt.timedelta(minutes=30)), device_class="door"))
        ha_sync.upsert_state(conn, _st("binary_sensor.door", "off", iso(now - dt.timedelta(minutes=10)), device_class="door"))
    for eid, x, y in (("binary_sensor.door", 0.3, 0.3), ("lock.front", 0.4, 0.4)):
        assert c.post(f"/api/v1/floors/{floor}/anchors", json={"resource_type": "ha_entity", "resource_id": eid, "x": x, "y": y, "layer_id": "doors"}).status_code == 201

    def at(when: dt.datetime) -> dict:
        m = c.get(f"/api/v1/floors/{floor}/map?at={iso(when)}").json()
        return {a["resource_id"]: a["entity"]["state_at"] for a in m["anchors"] if a["resource_type"] == "ha_entity"} | {"_cov": m["ha_history"], "_live": [a["entity"]["state"] for a in m["anchors"] if a["resource_type"] == "ha_entity"]}

    before = at(now - dt.timedelta(hours=3))
    assert before["binary_sensor.door"]["known"] is False and "לפני תחילת" in before["binary_sensor.door"]["reason"] and before["_cov"]["rows"] == 4
    assert before["_live"] == [None, None], "the historical bundle never shows the live value"
    mid = at(now - dt.timedelta(minutes=20))
    assert mid["binary_sensor.door"] == {"state": "on", "changed_at": iso(now - dt.timedelta(minutes=30)), "known": True, "reason": None}, "bounded by the later close"
    assert mid["lock.front"]["known"] is True and mid["lock.front"]["state"] == "locked", "confirmed 2 h ago, within the forward-fill bound"
    late = at(now - dt.timedelta(minutes=5))
    assert late["binary_sensor.door"]["state"] == "off" and late["binary_sensor.door"]["known"] is True
    with app.state.db.connection() as conn:
        # push the door's last confirmation 2 days back: the state is still the last known, but no longer "known now"
        conn.execute("UPDATE ha_state_history SET changed_at = ?, recorded_at = ? WHERE entity_id = 'binary_sensor.door' AND state = 'off' AND changed_at = ?", (iso(now - dt.timedelta(days=2)), iso(now - dt.timedelta(days=2)), iso(now - dt.timedelta(minutes=10))))
        conn.execute("UPDATE ha_state_history SET changed_at = ?, recorded_at = ? WHERE entity_id = 'binary_sensor.door' AND state = 'on'", (iso(now - dt.timedelta(days=2, minutes=30)), iso(now - dt.timedelta(days=2, minutes=30))))
        conn.execute("UPDATE ha_state_history SET recorded_at = ? WHERE recorded_at > ?", (iso(now - dt.timedelta(days=3)), iso(now - dt.timedelta(days=3))))
    stale = at(now - dt.timedelta(minutes=5))
    assert stale["binary_sensor.door"]["known"] is False and stale["binary_sensor.door"]["state"] == "off" and "24 שעות" in stale["binary_sensor.door"]["reason"]
    # a timezone change does not move the instant
    c.patch("/api/v1/settings", json={"time.zone": "Europe/London"})
    assert at(now - dt.timedelta(minutes=5))["binary_sensor.door"] == stale["binary_sensor.door"]
    # the live bundle keeps the live state and no state_at
    live = c.get(f"/api/v1/floors/{floor}/map").json()
    ent = next(a["entity"] for a in live["anchors"] if a["resource_id"] == "binary_sensor.door")
    assert ent["state"] == "off" and "state_at" not in ent and live["ha_history"] is None
    # retention
    with app.state.db.connection() as conn:
        conn.execute("INSERT INTO ha_state_history(entity_id, state, changed_at, recorded_at) VALUES ('x.y', 'on', '2020-01-01T00:00:00Z', '2020-01-01T00:00:00Z')")
        assert ha_history.prune(conn) == 1
        assert conn.execute("SELECT COUNT(*) FROM ha_state_history WHERE entity_id = 'x.y'").fetchone()[0] == 0
