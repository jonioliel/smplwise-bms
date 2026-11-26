"""CORE-RELIABILITY-2540, deep review CORE-03: a state change between the connect snapshot and the `state_changed`
subscription was lost (the snapshot was fetched and stored first, the subscription made after it, and nothing re-read the
states). Now the subscription comes first, the events of the snapshot window are held, and they are applied once the
snapshot is stored - an event older than what the snapshot stored is skipped.

The real HaSync session runs against a fake Home Assistant that, like the real one, delivers a `state_changed` event only
to a session that has subscribed to it."""
from __future__ import annotations

import asyncio
import copy
from typing import Any

from test_ha_structure_refresh import FakeHa, app_s, fast  # noqa: F401 - the shared fixtures

from smplwise.services import ha_client, ha_sync


def _state(app, entity_id: str) -> tuple[str | None, str | None]:
    with app.state.db.connection(mode="read") as conn:
        r = conn.execute("SELECT state, last_updated FROM ha_entities WHERE entity_id = ?", (entity_id,)).fetchone()
        return (r["state"], r["last_updated"]) if r else (None, None)


def _event(entity_id: str, old: str, new: str, at: str) -> dict[str, Any]:
    return {"entity_id": entity_id,
            "old_state": {"entity_id": entity_id, "state": old, "attributes": {}, "last_changed": "2026-09-28T09:00:00+00:00", "last_updated": "2026-09-28T09:00:00+00:00"},
            "new_state": {"entity_id": entity_id, "state": new, "attributes": {"friendly_name": "Front contact", "device_class": "door"},
                          "last_changed": at, "last_updated": at}}


def run_connect(app, s, fake: FakeHa, during_listing: list[dict[str, Any]], monkeypatch) -> None:
    """One real session: while HA answers `get_states` (the listing it sends is the state BEFORE the changes) the given
    `state_changed` events happen - delivered at once, and only when the session has subscribed to them (as HA does)."""

    async def ws_session(_settings, on_ready, on_event, stop, on_message=None):
        async def call(msg_type: str, **kw: Any) -> dict[str, Any]:
            reply = await fake.call(msg_type, **kw)
            if msg_type == "get_states" and "state_changed" in fake.subscribed:
                for data in during_listing:
                    on_event(copy.deepcopy(data))
            return reply

        await on_ready(call)

    monkeypatch.setattr(ha_client, "ws_session", ws_session)
    sync = ha_sync.HaSync()
    sync.db, sync.settings = app.state.db, s
    asyncio.run(sync._session(asyncio.Event()))


def test_core03_a_change_while_the_snapshot_is_taken_reaches_the_mirror(app_s, monkeypatch):
    app, s = app_s
    fake = FakeHa()
    # HA restarts; while Arx stores the snapshot (contact closed at 09:00) the front door opens at 09:05 and stays open
    opened = _event("binary_sensor.front_contact", "off", "on", "2026-09-28T09:05:00+00:00")
    run_connect(app, s, fake, [opened], monkeypatch)
    assert "state_changed" in fake.subscribed
    # before the fix the event was never delivered (no subscription yet) and the mirror kept "closed" until the next change
    assert _state(app, "binary_sensor.front_contact") == ("on", "2026-09-28T09:05:00+00:00")


def test_core03_the_state_events_are_subscribed_before_the_listing():
    import inspect

    src = inspect.getsource(ha_sync.HaSync._session)
    assert src.index('call("subscribe_events", event_type="state_changed")') < src.index('call("get_states")')


def test_core03_a_held_event_older_than_the_snapshot_is_skipped(app_s, monkeypatch):
    app, s = app_s
    fake = FakeHa()
    for st in fake.states:
        if st["entity_id"] == "lock.front":  # the listing already says unlocked at 09:10
            st.update(state="unlocked", last_changed="2026-09-28T09:10:00+00:00", last_updated="2026-09-28T09:10:00+00:00")
    older = _event("lock.front", "locked", "jammed", "2026-09-28T09:05:00+00:00")
    run_connect(app, s, fake, [older], monkeypatch)
    assert _state(app, "lock.front") == ("unlocked", "2026-09-28T09:10:00+00:00")


def test_core03_held_events_apply_in_order_after_the_snapshot(app_s, monkeypatch):
    app, s = app_s
    fake = FakeHa()
    events = [_event("binary_sensor.front_contact", "off", "on", "2026-09-28T09:05:00+00:00"),
              _event("binary_sensor.front_contact", "on", "off", "2026-09-28T09:06:00+00:00"),
              _event("binary_sensor.front_contact", "off", "on", "2026-09-28T09:07:00+00:00")]
    run_connect(app, s, fake, events, monkeypatch)
    assert _state(app, "binary_sensor.front_contact") == ("on", "2026-09-28T09:07:00+00:00")


def test_core03_stale_rule_and_compaction_are_pure():
    snap = {"a.x": "2026-09-28T10:00:00+00:00", "a.bad": "not a time"}
    ev = lambda eid, at: {"entity_id": eid, "new_state": {"entity_id": eid, "state": "on", "last_updated": at}}  # noqa: E731
    assert ha_sync.held_event_is_stale(ev("a.x", "2026-09-28T09:59:59+00:00"), snap) is True
    assert ha_sync.held_event_is_stale(ev("a.x", "2026-09-28T10:00:00+00:00"), snap) is False  # the same state: applied (its hooks run once)
    assert ha_sync.held_event_is_stale(ev("a.x", "2026-09-28T07:00:00Z"), snap) is True
    assert ha_sync.held_event_is_stale(ev("a.new", "2026-09-28T09:00:00+00:00"), snap) is False  # not in the snapshot: applied
    assert ha_sync.held_event_is_stale(ev("a.bad", "2026-09-28T09:00:00+00:00"), snap) is False  # unknown time: applied
    assert ha_sync.held_event_is_stale({"entity_id": "a.x", "new_state": None, "old_state": {}}, snap) is False  # a removal applies
    held = [{"entity_id": "a.1", "n": 1}, {"entity_id": "a.2", "n": 2}, {"entity_id": "a.1", "n": 3}]
    assert [d["n"] for d in ha_sync.compact_held(held)] == [2, 3]
