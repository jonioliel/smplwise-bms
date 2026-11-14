"""Owner report 2026-09-30 (a second installation): its switches all showed "not available", the home screen carried the
amber "not synced" badge and the tiles counted a fraction of what was on. Root cause: one integration (130 switches, 3
numbers) puts a LIST in the `supported_features` attribute (`["timer_on"]`; HA's own contract is an int bit-mask).
`upsert_state` did `int(list)`, the TypeError escaped the state snapshot, the session dropped and was retried forever
(every 60 s): `state_changed` was never subscribed (not synced), and every entity the registry listing had created stayed
`available = 0` (the UI's "לא זמין"), except the states of the chunks that happened to commit before the bad row.

Data here is anonymised and synthetic - the shapes are what matter: a list-valued `supported_features` on many switches,
beside healthy switches, lights and covers, and two entities that really are `unavailable` in HA."""
from __future__ import annotations

from dataclasses import replace
from typing import Any

import pytest
from test_ha_structure_refresh import FakeHa, run_session  # the fake HA + the real-session runner

from smplwise.services import devices, ha_history, ha_sync

NOW = "2026-09-30T10:00:00+00:00"


def _state(eid: str, state: str, **attrs: Any) -> dict[str, Any]:
    return {"entity_id": eid, "state": state, "attributes": {"friendly_name": eid.split(".", 1)[1], **attrs}, "last_changed": NOW, "last_updated": NOW}


def installation_states() -> list[dict[str, Any]]:
    """Shape of the real data: 130 timer switches of one integration (list feature attribute, 33 on), 10 plain switches of
    other integrations (2 really unavailable), 4 lights, 3 numbers with the same list attribute, 5 covers."""
    out = []
    for i in range(130):
        out.append(_state(f"switch.timer_{i:03d}", "on" if i < 33 else "off", supported_features=["timer_on"]))
    for i in range(8):
        out.append(_state(f"switch.plain_{i}", "on" if i < 3 else "off"))
    out += [_state("switch.plain_gone_a", "unavailable"), _state("switch.plain_gone_b", "unavailable")]
    out += [_state(f"light.l{i}", "off") for i in range(4)]
    out += [_state(f"number.n{i}", "5", supported_features=["timer_on"]) for i in range(3)]
    out += [_state(f"cover.c{i}", "open" if i % 2 else "closed", current_position=50) for i in range(5)]
    return out


def registry_for(states: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [{"entity_id": s["entity_id"], "id": f"reg-{s['entity_id']}", "area_id": None, "device_id": None, "entity_category": None,
             "platform": "timer_integration" if "timer_" in s["entity_id"] else "other"} for s in states]


def test_feature_bits_never_raises_and_keeps_real_masks():
    assert ha_sync.feature_bits(7) == 7
    assert ha_sync.feature_bits(0) == 0
    assert ha_sync.feature_bits(None) == 0
    assert ha_sync.feature_bits(["timer_on"]) == 0
    assert ha_sync.feature_bits({"a": 1}) == 0
    assert ha_sync.feature_bits("12") == 12
    assert ha_sync.feature_bits("timer") == 0
    assert ha_sync.feature_bits(True) == 0
    assert ha_sync.feature_bits(3.0) == 3


def test_upsert_state_takes_odd_attribute_shapes(dev_db):
    with dev_db.connection() as conn:
        row = ha_sync.upsert_state(conn, _state("switch.odd", "on", supported_features=["timer_on"], icon=["x"], device_class={"k": 1}, unit_of_measurement=["y"]))
    assert row["state"] == "on" and row["available"] is True and row["supported_features"] == 0
    assert row["icon"] is None and row["device_class"] is None and row["unit"] is None
    assert row["attributes"]["supported_features"] == ["timer_on"]  # the raw attribute stays readable


def test_a_snapshot_with_a_list_feature_switch_is_stored_whole(dev_db):
    states = installation_states()
    ha_sync.store_states(dev_db, states, NOW)
    with dev_db.connection(mode="read") as conn:
        stored = {r["entity_id"]: r for r in conn.execute("SELECT entity_id, state, available FROM ha_entities")}
    assert len(stored) == len(states)
    assert all(stored[s["entity_id"]]["state"] == s["state"] for s in states)
    assert sum(1 for r in stored.values() if not r["available"]) == 2  # only the two that really are unavailable


def test_one_unstorable_state_costs_only_itself(dev_db, monkeypatch):
    """Even a shape nobody foresaw: the chunk and the snapshot survive, the bad state is skipped and logged."""
    real = ha_history.record

    def record(conn, st):
        if st["entity_id"] == "switch.timer_040":
            raise ValueError("unforeseen")
        return real(conn, st)

    monkeypatch.setattr(ha_history, "record", record)
    states = installation_states()
    present = ha_sync.store_states(dev_db, states, NOW)
    assert "switch.timer_040" in present
    with dev_db.connection(mode="read") as conn:
        n = conn.execute("SELECT COUNT(*) FROM ha_entities WHERE state_seen_at IS NOT NULL").fetchone()[0]
        bad = conn.execute("SELECT state_seen_at FROM ha_entities WHERE entity_id = 'switch.timer_040'").fetchone()
    assert n == len(states) - 1 and bad is None  # nothing half-written for the skipped one, everything else in


def test_the_devices_counts_match_home_assistant_for_the_same_data(dev_db):
    """The offline replay of the owner's report: registry first (as the session does), then the snapshot."""
    states = installation_states()
    from smplwise.services import ha_client

    maps = ha_client.registry_maps(registry_for(states), [], [], [])
    with dev_db.connection() as conn:
        ha_sync.apply_registry(conn, maps)
    ha_sync.store_states(dev_db, states, NOW)
    ha_sync.STATE.connected = True
    try:
        with dev_db.connection(mode="read") as conn:
            entities = [e for e in devices.load_entities(conn) if e["domain"] == "switch"]
            rows = [devices.card_row(e, True) for e in entities]
    finally:
        ha_sync.STATE.connected = False
    assert len(rows) == 140
    assert sum(1 for r in rows if devices._unavailable(r)) == 2
    assert sum(1 for r in rows if r["active"] and not devices._unavailable(r)) == 33 + 3
    assert all(r["fresh"] for r in rows)


@pytest.fixture()
def dev_db(settings):
    from smplwise.main import create_app

    app = create_app(replace(settings, ha_url="http://ha.local:8123", ha_token="secret-token-value"))
    return app.state.db


def test_the_session_connects_and_subscribes_with_such_a_snapshot(settings, monkeypatch):
    """The real HaSync session against a fake HA serving the shapes above: it reaches `connected` and subscribes to
    `state_changed` (before the fix it raised out of the snapshot and never did, however often it retried)."""
    from smplwise.main import create_app

    monkeypatch.setattr(ha_sync, "REGISTRY_DEBOUNCE_S", 0.05)
    s = replace(settings, ha_url="http://ha.local:8123", ha_token="secret-token-value")
    app = create_app(s)
    fake = FakeHa()
    states = installation_states()
    fake.states = states
    fake.entities = registry_for(states)
    fake.devices, fake.areas, fake.floors = [], [], []
    seen: dict[str, Any] = {}

    async def script(_on_event, _on_message, _settle):
        seen["connected"] = ha_sync.STATE.connected
        seen["entities"] = ha_sync.STATE.entities

    try:
        run_session(app, s, fake, script, monkeypatch)
    finally:
        ha_sync.STATE.connected = False
    assert seen["connected"] is True
    assert "state_changed" in fake.subscribed
    assert seen["entities"] >= 140
    with app.state.db.connection(mode="read") as conn:
        unavailable = conn.execute("SELECT COUNT(*) FROM ha_entities WHERE domain = 'switch' AND available = 0").fetchone()[0]
    assert unavailable == 2
