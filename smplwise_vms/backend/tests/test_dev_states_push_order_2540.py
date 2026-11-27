"""HOME-SPEC-STABLE-2540: the fixture's state injection (`POST /ha/dev/states`, developer identity mode only) pushes AFTER its commit.

The real path (ha_sync.on_state_changed) stores the row first and pushes second, so a screen that refetches on the push reads the new
state. The dev endpoint used to publish inside the request, before the request's transaction committed: a screen whose refetch reached
the server in that window read the OLD state and, with no further push, kept it until its slow fallback poll (5 min) - the home
screen's weather card in evidence-home-screen.spec.ts stayed at 31 °C after the outdoor sensor was set to 18.2. Measured on the runner,
docs/changes/HOME-SPEC-STABLE-2540.md."""
from __future__ import annotations

from dataclasses import replace

import pytest
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import ha_client, ha_sync

STATES = [
    {"entity_id": "sensor.outdoor", "state": "31.4", "attributes": {"friendly_name": "Outdoor", "unit_of_measurement": "°C", "device_class": "temperature"}, "last_changed": "2026-11-26T10:00:00+00:00", "last_updated": "2026-11-26T10:00:00+00:00"},
]


@pytest.fixture()
def ha_app(settings, monkeypatch):
    s = replace(settings, ha_url="http://ha.local:8123", ha_token="t")
    monkeypatch.setattr(ha_client, "get_states", lambda _s: STATES)
    app = create_app(s)
    ha_sync.STATE.connected = True  # the socket thread is not started in tests
    ha_sync.snapshot(app.state.db, s)
    return app


def test_dev_states_push_reads_the_committed_state(ha_app, monkeypatch):
    """At the moment the push goes out, another connection (a screen's refetch) already reads the new state."""
    db = ha_app.state.db
    seen: list[tuple[str, str]] = []
    real = ha_sync.publish

    def spy(msg):
        if msg.get("type") == "entity_state_changed":
            eid = msg["entity"]["entity_id"]
            with db.connection(mode="read") as conn:
                seen.append((eid, conn.execute("SELECT state FROM ha_entities WHERE entity_id = ?", (eid,)).fetchone()[0]))
        real(msg)

    monkeypatch.setattr(ha_sync, "publish", spy)
    c = TestClient(ha_app)
    observer = ha_sync.subscribe()
    try:
        r = c.post("/api/v1/ha/dev/states", json={"states": [{"entity_id": "sensor.outdoor", "state": "18.2", "attributes": {"friendly_name": "Outdoor", "unit_of_measurement": "°C"}}]})
        assert r.status_code == 200, r.text
        assert r.json()["entities"][0]["state"] == "18.2"
        assert seen == [("sensor.outdoor", "18.2")], seen  # was [("sensor.outdoor", "31.4")]: the push left before the commit
        # the push itself is unchanged: one entity_state_changed frame with the stored row and a new sequence
        msg = observer.get(timeout=2)
        assert msg["type"] == "entity_state_changed" and msg["entity"]["entity_id"] == "sensor.outdoor" and msg["entity"]["state"] == "18.2"
        assert msg["sequence"] == ha_sync.STATE.sequence
    finally:
        ha_sync.unsubscribe(observer)


def test_dev_states_pushes_every_entity_in_order(ha_app):
    """Several states in one call: one push each, in the call's order, each after the commit."""
    c = TestClient(ha_app)
    observer = ha_sync.subscribe()
    try:
        r = c.post("/api/v1/ha/dev/states", json={"states": [{"entity_id": "sensor.outdoor", "state": "20"}, {"entity_id": "sensor.second", "state": "5"}]})
        assert r.status_code == 200, r.text
        got = [observer.get(timeout=2) for _ in range(2)]
        assert [m["entity"]["entity_id"] for m in got] == ["sensor.outdoor", "sensor.second"]
        assert got[0]["sequence"] < got[1]["sequence"]
    finally:
        ha_sync.unsubscribe(observer)
