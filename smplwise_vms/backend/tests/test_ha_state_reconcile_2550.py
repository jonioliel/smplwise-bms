"""HA-STATE-RECONCILE-2550 (deep review CORE-03, its second suggestion; CORE-RELIABILITY-2540 open question 1 = a): a periodic full
state reconcile. Every `ha.state_reconcile_min` minutes (10 by default, 0 = off) the session reads all states once (one read-only
`get_states`) and writes only the states Home Assistant reports as strictly newer than the stored ones - a state update lost while
the database was busy is repaired; an older listing never replaces a newer event; a live event during the cycle wins; a cycle is
skipped while Home Assistant is disconnected or another cycle runs.

The real HaSync session runs against a fake Home Assistant (`ha_client.ws_session` replaced), as in test_ha_structure_refresh."""
# the shared fixture imported from its module is the test functions' argument (pytest injects it):
# ruff: noqa: F811
from __future__ import annotations

import asyncio
import copy
import logging
import queue
import sqlite3
from typing import Any

from fastapi.testclient import TestClient
from test_ha_structure_refresh import FakeHa, app_s, fast  # noqa: F401 - the shared fixtures

from smplwise.services import ha_client, ha_sync


def _row(app, entity_id: str) -> dict[str, Any] | None:
    with app.state.db.connection(mode="read") as conn:
        r = conn.execute("SELECT state, last_updated, available, removed_at, state_seen_at FROM ha_entities WHERE entity_id = ?", (entity_id,)).fetchone()
        return dict(r) if r else None


def _event(entity_id: str, old: str, new: str, at: str, old_at: str = "2026-09-28T09:00:00+00:00") -> dict[str, Any]:
    return {"entity_id": entity_id,
            "old_state": {"entity_id": entity_id, "state": old, "attributes": {}, "last_changed": old_at, "last_updated": old_at},
            "new_state": {"entity_id": entity_id, "state": new, "attributes": {"friendly_name": "Front contact", "device_class": "door"},
                          "last_changed": at, "last_updated": at}}


def _set_listing(fake: FakeHa, entity_id: str, state: str, at: str) -> None:
    for st in fake.states:
        if st["entity_id"] == entity_id:
            st.update(state=state, last_changed=at, last_updated=at)
            return
    raise AssertionError(entity_id)


def _fake() -> FakeHa:
    """A fake Home Assistant whose state listing is this test's own copy (the shared STATES of test_devices stay untouched)."""
    fake = FakeHa()
    fake.states = copy.deepcopy(fake.states)
    return fake


def run(app, s, fake: FakeHa, script, monkeypatch, *, call=None) -> tuple[ha_sync.HaSync, list[dict[str, Any]]]:
    """One real session against `fake` (or the given `call` wrapper); `script(sync, on_event, call)` runs once it is ready.
    Returns the sync object and every message the session published after it was ready."""
    the_call = call or fake.call
    msgs: list[dict[str, Any]] = []
    q = ha_sync.subscribe()

    async def ws_session(_settings, on_ready, on_event, stop, on_message=None):
        await on_ready(the_call)
        while True:  # drop what the connect published
            try:
                q.get_nowait()
            except queue.Empty:
                break
        await script(sync, on_event, the_call)

    monkeypatch.setattr(ha_client, "ws_session", ws_session)
    sync = ha_sync.HaSync()
    sync.db, sync.settings = app.state.db, s
    try:
        asyncio.run(sync._session(asyncio.Event()))
    finally:
        ha_sync.unsubscribe(q)
    while True:
        try:
            msgs.append(q.get_nowait())
        except queue.Empty:
            return sync, msgs


def test_a_state_update_lost_to_a_busy_database_is_repaired(app_s, monkeypatch):
    app, s = app_s
    fake = _fake()
    out: dict[str, Any] = {}

    async def script(sync, on_event, call):
        real = ha_sync.handle_state_event

        def busy(db, data, attempts=1):
            raise sqlite3.OperationalError("database is locked")

        # the front door opens at 09:05 while another worker holds the write lock past busy_timeout: the update is lost
        monkeypatch.setattr(ha_sync, "handle_state_event", busy)
        on_event(_event("binary_sensor.front_contact", "off", "on", "2026-09-28T09:05:00+00:00"))
        # CORE10-EVENTLOOP-2560: the frame is handled on the state worker now - wait for it before the real writer is put back
        await asyncio.get_running_loop().run_in_executor(None, ha_sync.STATE_WORKER.wait_idle, 10.0)
        monkeypatch.setattr(ha_sync, "handle_state_event", real)
        out["lost"] = _row(app, "binary_sensor.front_contact")
        _set_listing(fake, "binary_sensor.front_contact", "on", "2026-09-28T09:05:00+00:00")  # what HA itself holds
        out["result"] = await sync.reconcile_now(call)

    _, msgs = run(app, s, fake, script, monkeypatch)
    assert out["lost"]["state"] == "off"  # the precondition: the busy database really lost it
    row = _row(app, "binary_sensor.front_contact")
    assert (row["state"], row["last_updated"], row["available"]) == ("on", "2026-09-28T09:05:00+00:00", 1)
    assert out["result"]["repaired"] == 1 and out["result"]["failed"] == 0
    assert out["result"]["same"] == out["result"]["read"] - 1  # nothing else was written
    pushed = [m for m in msgs if m.get("type") == "entity_state_changed"]
    assert [m["entity"]["entity_id"] for m in pushed] == ["binary_sensor.front_contact"] and pushed[0]["entity"]["state"] == "on"
    with app.state.db.connection(mode="read") as conn:  # the history knows the repaired state at its own time
        hist = conn.execute("SELECT state, changed_at FROM ha_state_history WHERE entity_id = ? ORDER BY changed_at DESC LIMIT 1",
                            ("binary_sensor.front_contact",)).fetchone()
    assert hist["state"] == "on" and hist["changed_at"].startswith("2026-09-28T09:05:00")


def test_an_older_listing_never_overwrites_a_newer_event(app_s, monkeypatch):
    app, s = app_s
    fake = _fake()
    out: dict[str, Any] = {}

    async def script(sync, on_event, call):
        on_event(_event("binary_sensor.front_contact", "off", "on", "2026-09-28T09:10:00+00:00"))
        # the listing HA answers is older than the event the mirror already holds (an earlier, slower answer)
        _set_listing(fake, "binary_sensor.front_contact", "off", "2026-09-28T09:05:00+00:00")
        out["result"] = await sync.reconcile_now(call)

    _, msgs = run(app, s, fake, script, monkeypatch)
    assert _row(app, "binary_sensor.front_contact")["state"] == "on"
    assert _row(app, "binary_sensor.front_contact")["last_updated"] == "2026-09-28T09:10:00+00:00"
    assert out["result"]["older"] == 1 and out["result"]["repaired"] == 0
    assert not [m for m in msgs if m.get("type") == "entity_state_changed" and m["entity"]["entity_id"] == "binary_sensor.front_contact"
                and m["entity"]["state"] == "off"]


def test_a_live_event_during_the_cycle_wins_over_its_listing(app_s, monkeypatch):
    """HA removes the lock's state (an integration reload) while the reconcile's listing is in flight; the listing still shows the
    lock with a newer time. Without the live-event rule the listing would make the removed state available again."""
    app, s = app_s
    fake = _fake()
    out: dict[str, Any] = {}
    on_event_ref: list[Any] = []

    async def call(msg_type: str, **kw: Any) -> dict[str, Any]:
        reply = await fake.call(msg_type, **kw)
        if msg_type == "get_states" and on_event_ref:
            on_event_ref[0]({"entity_id": "lock.front", "old_state": {"entity_id": "lock.front", "state": "locked"}, "new_state": None})
        return reply

    async def script(sync, on_event, call):
        _set_listing(fake, "lock.front", "unlocked", "2026-09-28T09:30:00+00:00")
        on_event_ref.append(on_event)
        out["result"] = await sync.reconcile_now(call)

    run(app, s, fake, script, monkeypatch, call=call)
    row = _row(app, "lock.front")
    assert row["available"] == 0 and row["state"] == "locked"  # the removal stands; the listing did not undo it
    assert out["result"]["live"] == 1 and out["result"]["repaired"] == 0


def test_unknown_and_unavailable_are_kept_as_they_are(app_s, monkeypatch):
    app, s = app_s
    fake = _fake()
    out: dict[str, Any] = {}

    async def script(sync, on_event, call):
        on_event(_event("binary_sensor.front_contact", "off", "unknown", "2026-09-28T09:20:00+00:00"))
        # the same unknown state at the same time: left alone; a newer "unavailable" is written as it is (not hidden, not guessed)
        _set_listing(fake, "binary_sensor.front_contact", "unknown", "2026-09-28T09:20:00+00:00")
        _set_listing(fake, "lock.front", "unavailable", "2026-09-28T09:25:00+00:00")
        # a listing time that cannot be read never replaces a known state
        _set_listing(fake, "light.lobby", "off", "not-a-time")
        out["result"] = await sync.reconcile_now(call)

    run(app, s, fake, script, monkeypatch)
    assert _row(app, "binary_sensor.front_contact")["state"] == "unknown"
    lock = _row(app, "lock.front")
    assert (lock["state"], lock["available"], lock["last_updated"]) == ("unavailable", 0, "2026-09-28T09:25:00+00:00")
    assert _row(app, "light.lobby")["state"] == "on"
    assert out["result"]["repaired"] == 1 and out["result"]["unknown_time"] == 1


def test_skipped_while_disconnected_and_while_another_cycle_runs(app_s, monkeypatch):
    app, s = app_s
    fake = _fake()
    gate = asyncio.Event
    out: dict[str, Any] = {}
    hold: dict[str, Any] = {}

    async def call(msg_type: str, **kw: Any) -> dict[str, Any]:
        if msg_type == "get_states" and "gate" in hold:
            hold["waiting"].set()
            await hold["gate"].wait()
        return await fake.call(msg_type, **kw)

    async def script(sync, on_event, call):
        before = fake.calls.count("get_states")
        hold["gate"], hold["waiting"] = gate(), gate()
        first = asyncio.create_task(sync.reconcile_now(call))
        await asyncio.wait_for(hold["waiting"].wait(), 5)
        out["busy"] = await sync.reconcile_now(call)  # the first one still waits for its listing
        hold["gate"].set()
        out["first"] = await first
        del hold["gate"]
        ha_sync.STATE.connected = False
        out["down"] = await sync.reconcile_now(call)
        ha_sync.STATE.connected = True
        out["asked"] = fake.calls.count("get_states") - before

    sync, _ = run(app, s, fake, script, monkeypatch, call=call)
    assert out["busy"] == {"skipped": "busy"}
    assert out["down"] == {"skipped": "disconnected"}
    assert "repaired" in out["first"] and out["first"]["failed"] == 0
    assert out["asked"] == 1  # only the first cycle asked Home Assistant
    assert sync._reconcile_touched is None


def test_a_refused_listing_writes_nothing(app_s, monkeypatch):
    app, s = app_s
    fake = _fake()
    out: dict[str, Any] = {}

    async def script(sync, on_event, call):
        _set_listing(fake, "lock.front", "unlocked", "2026-09-28T09:30:00+00:00")
        fake.fail.add("get_states")
        out["result"] = await sync.reconcile_now(call)

    run(app, s, fake, script, monkeypatch)
    assert out["result"] == {"skipped": "refused"}
    assert _row(app, "lock.front")["state"] == "locked"


def test_the_loop_runs_on_the_interval_and_not_when_off(app_s, monkeypatch):
    app, s = app_s
    monkeypatch.setattr(ha_sync, "RECONCILE_TICK_S", 0.01)

    def asked(interval_s: float) -> int:
        fake = _fake()
        monkeypatch.setattr(ha_sync, "reconcile_interval_s", lambda _db: interval_s)

        async def script(sync, on_event, call):
            await asyncio.sleep(0.4)

        run(app, s, fake, script, monkeypatch)
        return fake.calls.count("get_states") - 1  # the connect snapshot is the first one

    assert asked(0.05) >= 2
    assert asked(0.0) == 0


def test_one_summary_line_without_entity_ids(app_s, monkeypatch, caplog):
    app, s = app_s
    fake = _fake()

    async def script(sync, on_event, call):
        _set_listing(fake, "lock.front", "unlocked", "2026-09-28T09:30:00+00:00")
        await sync.reconcile_now(call)

    with caplog.at_level(logging.DEBUG, logger="smplwise.ha"):
        run(app, s, fake, script, monkeypatch)
    lines = [r.getMessage() for r in caplog.records if r.levelno >= logging.INFO and "reconcile" in r.getMessage()]
    assert len(lines) == 1, lines
    assert "1 repaired" in lines[0]
    ids = {st["entity_id"] for st in fake.states}
    assert not any(eid in lines[0] for eid in ids)
    assert _row(app, "lock.front")["state"] == "unlocked"


def test_decision_rule_and_interval_setting_are_pure():
    touched: set[str] = {"a.live"}
    row = lambda state, at, removed=None: {"state": state, "last_updated": at, "removed_at": removed}  # noqa: E731
    snap = lambda eid, at: {"entity_id": eid, "state": "on", "last_updated": at}  # noqa: E731
    t9, t10 = "2026-09-28T09:00:00+00:00", "2026-09-28T10:00:00Z"
    assert ha_sync.reconcile_decision(snap("a.x", t10), row("off", t9), touched) == "repaired"
    assert ha_sync.reconcile_decision(snap("a.x", t9), row("off", t10), touched) == "older"
    assert ha_sync.reconcile_decision(snap("a.x", t9), row("off", t9), touched) == "same"
    assert ha_sync.reconcile_decision(snap("a.live", t10), row("off", t9), touched) == "live"
    assert ha_sync.reconcile_decision(snap("a.x", t10), row("off", t9, "2026-09-28T09:30:00Z"), touched) == "removed"
    assert ha_sync.reconcile_decision(snap("a.x", t10), None, touched) == "repaired"  # not in the mirror yet
    assert ha_sync.reconcile_decision(snap("a.x", "bad"), row(None, None), touched) == "repaired"  # a registry-only row
    assert ha_sync.reconcile_decision(snap("a.x", "bad"), row("off", t9), touched) == "unknown_time"
    assert ha_sync.reconcile_decision(snap("a.x", t10), row("off", None), touched) == "unknown_time"
    m = ha_sync.reconcile_interval_min
    assert [m(10), m("10"), m(0), m("0"), m(3), m(5), m(99999), m(-4), m("x"), m(None)] == [10, 10, 0, 0, 5, 5, 1440, 10, 10, 10]


def test_the_interval_setting_round_trip(settings):
    from smplwise.main import create_app

    app = create_app(settings)
    with TestClient(app) as c:
        assert c.get("/api/v1/settings").json()["settings"]["ha.state_reconcile_min"] == 10
        assert ha_sync.reconcile_interval_s(app.state.db) == 600.0
        for bad in (3, 1, -1, 1441, "often"):
            assert c.patch("/api/v1/settings", json={"ha.state_reconcile_min": bad}).status_code == 422, bad
        r = c.patch("/api/v1/settings", json={"ha.state_reconcile_min": 0})
        assert r.status_code == 200, r.text
        assert r.json()["settings"]["ha.state_reconcile_min"] == 0
        assert ha_sync.reconcile_interval_s(app.state.db) == 0.0
        assert c.patch("/api/v1/settings", json={"ha.state_reconcile_min": 30}).status_code == 200
        assert ha_sync.reconcile_interval_s(app.state.db) == 1800.0

