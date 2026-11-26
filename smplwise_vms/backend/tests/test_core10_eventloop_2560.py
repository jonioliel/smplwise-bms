"""CORE10-EVENTLOOP-2560 (deep review CORE-10): the work of a Home Assistant state frame runs on the state worker, never on the
socket reader / the feed's event loop.

Each test runs the real HaSync session against a fake Home Assistant whose reader calls the session's `on_event` the way
`ha_client.ws_session`'s reader does (synchronously, on the session loop). Before the change `on_event` did the whole mirror write
and the rule delivery inline: a locked database or a slow notify call kept the reader (and every pending reply) waiting.
The load numbers are in tests/test_core10_eventloop_load_2560.py (timing lane)."""
# the shared fixture imported from its module is the test functions' argument (pytest injects it):
# ruff: noqa: F811
from __future__ import annotations

import asyncio
import copy
import queue
import threading
import time
from typing import Any

from test_ha_structure_refresh import FakeHa, app_s, fast  # noqa: F401 - the shared fixtures

from smplwise.services import ha_client, ha_sync
from smplwise.services import rules as rules_svc


def _state(app, entity_id: str) -> str | None:
    with app.state.db.connection(mode="read") as conn:
        r = conn.execute("SELECT state FROM ha_entities WHERE entity_id = ?", (entity_id,)).fetchone()
        return r["state"] if r else None


def _event(entity_id: str, old: str | None, new: str, n: int, device_class: str | None = None) -> dict[str, Any]:
    at = f"2026-11-26T10:{n // 60:02d}:{n % 60:02d}+00:00"
    attrs = {"friendly_name": entity_id, **({"device_class": device_class} if device_class else {})}
    return {"entity_id": entity_id,
            "old_state": None if old is None else {"entity_id": entity_id, "state": old, "attributes": attrs, "last_changed": "2026-11-26T09:00:00+00:00", "last_updated": "2026-11-26T09:00:00+00:00"},
            "new_state": {"entity_id": entity_id, "state": new, "attributes": attrs, "last_changed": at, "last_updated": at}}


def run_session(app, s, fake: FakeHa, script, monkeypatch) -> list[dict[str, Any]]:
    """One real session; `script(on_event, call)` runs on the session loop once it is ready. Returns what was published."""

    async def ws_session(_settings, on_ready, on_event, stop, on_message=None):  # noqa: ARG001
        await on_ready(fake.call)
        await script(on_event, fake.call)

    monkeypatch.setattr(ha_client, "ws_session", ws_session)
    sync = ha_sync.HaSync()
    sync.db, sync.settings = app.state.db, s
    q = ha_sync.subscribe()
    try:
        asyncio.run(sync._session(asyncio.Event()))
    finally:
        ha_sync.unsubscribe(q)
    out = []
    while True:
        try:
            out.append(q.get_nowait())
        except queue.Empty:
            return out


async def wait_until(cond, timeout: float = 10.0) -> None:
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        if cond():
            return
        await asyncio.sleep(0.02)
    raise AssertionError("condition not met in time")


def test_a_locked_database_no_longer_blocks_the_reader(app_s, monkeypatch):
    """Another writer holds the write lock for a second (a backup, CORE-05). The reader hands the frame on at once; the row is
    stored once the lock is free. Before: `on_event` waited the whole second (up to BUSY_TIMEOUT_S) on the socket's loop."""
    app, s = app_s
    took: dict[str, float] = {}
    locked, release = threading.Event(), threading.Event()

    def hold() -> None:
        with app.state.db.connection(label="core10.test_lock"):
            locked.set()
            release.wait(5)

    async def script(on_event, _call):
        holder = threading.Thread(target=hold, daemon=True)
        holder.start()
        assert locked.wait(5)
        t0 = time.perf_counter()
        on_event(_event("sensor.core10_power", None, "42", 1))
        took["handler"] = time.perf_counter() - t0
        assert _state(app, "sensor.core10_power") is None  # still waiting for the lock - on the worker, not here
        await asyncio.sleep(0.3)
        release.set()
        holder.join(5)

    run_session(app, s, FakeHa(), script, monkeypatch)
    assert took["handler"] < 0.1, took
    assert _state(app, "sensor.core10_power") == "42"


def test_a_slow_rule_notification_blocks_neither_the_reader_nor_the_next_state(app_s, monkeypatch):
    """A rule with a Home Assistant notify action fires and Home Assistant answers slowly. The reader stays free and the next
    state is stored while the notification is still being sent (its own delivery thread). Before: both waited for the POST."""
    app, s = app_s
    sending, answer = threading.Event(), threading.Event()
    sent: list[str] = []

    def evaluate_event(conn, transition, deliver=True):  # noqa: ARG001
        return [{"_pending": [("mobile_app_owner", "door opened", "core10")], "ha_notify": {}, "announce": []}]

    def slow_notify(service: str, message: str, title: str) -> str:  # noqa: ARG001
        sending.set()
        answer.wait(5)
        sent.append(service)
        return "sent"

    monkeypatch.setattr(rules_svc, "evaluate_event", evaluate_event)
    monkeypatch.setattr(rules_svc, "HA_NOTIFY", slow_notify)
    took: dict[str, float] = {}

    async def script(on_event, _call):
        t0 = time.perf_counter()
        on_event(_event("binary_sensor.core10_door", "off", "on", 1, "door"))  # a door transition: the rule fires
        took["first"] = time.perf_counter() - t0
        await wait_until(sending.is_set)
        t0 = time.perf_counter()
        on_event(_event("sensor.core10_power", None, "7", 2))
        took["second"] = time.perf_counter() - t0
        await wait_until(lambda: _state(app, "sensor.core10_power") == "7")
        took["notify_still_running"] = not answer.is_set() and not sent
        answer.set()
        await wait_until(lambda: sent == ["mobile_app_owner"])

    run_session(app, s, FakeHa(), script, monkeypatch)
    assert took["first"] < 0.1 and took["second"] < 0.1, took
    assert took["notify_still_running"] is True, "the next state was stored while the notification was still being sent"
    assert _state(app, "binary_sensor.core10_door") == "on"


def test_the_order_of_every_frame_is_kept(app_s, monkeypatch):
    """One consumer: frames are stored in the order the socket delivered them, per entity and across entities."""
    app, s = app_s
    order: list[tuple[str, str]] = []
    real = ha_sync.on_state_changed

    def recording(db, data, *args, **kw):
        order.append((data["entity_id"], data["new_state"]["state"]))
        return real(db, data, *args, **kw)

    monkeypatch.setattr(ha_sync, "on_state_changed", recording)
    sent: list[tuple[str, str]] = []

    async def script(on_event, _call):
        for n in range(240):
            eid = f"sensor.core10_{n % 3}"
            sent.append((eid, str(n)))
            on_event(_event(eid, None, str(n), n))

    run_session(app, s, FakeHa(), script, monkeypatch)
    assert order == sent
    assert [_state(app, f"sensor.core10_{i}") for i in range(3)] == ["237", "238", "239"]


def test_a_full_queue_is_counted_and_every_state_is_re_read(app_s, monkeypatch):
    """The worker is stuck (a long lock) and the queue fills: the refused frames are counted - never silently - and once the
    worker catches up the session re-reads every state from Home Assistant, stores it behind the queued frames and tells the
    screens to refetch (`structure_changed`, reason `resync`, the CORE-06 signal)."""
    app, s = app_s
    fake = FakeHa()
    monkeypatch.setattr(ha_sync.STATE_WORKER, "maxsize", 3)
    overflows0, resyncs0 = ha_sync.STATE.state_overflows, ha_sync.STATE.state_resyncs
    stuck = threading.Event()

    async def script(on_event, _call):
        ha_sync.STATE_WORKER.submit(stuck.wait, 5, bounded=False)
        for n in range(10):  # 3 fit, 7 are refused
            on_event(_event("sensor.core10_level", None, str(n), n))
        # what Home Assistant holds now: the last change
        fake.states.append(copy.deepcopy(_event("sensor.core10_level", None, "9", 9)["new_state"]))
        assert ha_sync.STATE.state_overflows - overflows0 == 7
        stuck.set()
        await wait_until(lambda: ha_sync.STATE.state_resyncs > resyncs0)

    published = run_session(app, s, fake, script, monkeypatch)
    assert ha_sync.STATE.state_resyncs - resyncs0 == 1
    assert fake.calls.count("get_states") == 2  # the connect snapshot and the one re-read
    assert _state(app, "sensor.core10_level") == "9", "the re-read brought the state the refused frames carried"
    assert any(m.get("type") == "structure_changed" and m.get("reason") == "resync" for m in published)


def test_the_snapshot_waits_for_an_earlier_sessions_frames(app_s, monkeypatch):
    """A frame of an earlier session still being stored would land after the new connect snapshot and overwrite it."""
    app, s = app_s
    idle_at_store: list[bool] = []
    real_store = ha_sync.store_states

    def store(db, states, seen):
        idle_at_store.append(ha_sync.STATE_WORKER.idle())
        return real_store(db, states, seen)

    monkeypatch.setattr(ha_sync, "store_states", store)
    ha_sync.STATE_WORKER.submit(time.sleep, 0.3, bounded=False)  # the earlier session's last frame, still running

    async def script(_on_event, _call):
        return None

    run_session(app, s, FakeHa(), script, monkeypatch)
    assert idle_at_store == [True]


def test_the_worker_survives_a_failing_job_and_reports_its_numbers():
    from smplwise.services import ha_state_worker

    w = ha_state_worker.StateWorker(name="core10-test-worker", maxsize=2)
    gate = threading.Event()
    done: list[int] = []
    assert w.submit(gate.wait, 5, bounded=False)
    assert w.submit(done.append, 1) and w.submit(lambda: 1 / 0)
    assert w.submit(done.append, 2) is False and w.refused == 1  # two frames wait: the third is refused
    assert w.submit(done.append, 3, bounded=False)  # a control job is never refused
    assert w.wait_idle(0.05) is False
    gate.set()
    assert w.wait_idle(5) is True
    assert done == [1, 3] and w.failed == 1 and w.done == 4 and w.max_depth >= 3
    assert w.submit(done.append, 4) and w.wait_idle(5) and done == [1, 3, 4]
