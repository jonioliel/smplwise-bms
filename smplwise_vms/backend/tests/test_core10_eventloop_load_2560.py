"""CORE10-EVENTLOOP-2560 (deep review CORE-10): the load test of the Home Assistant state feed.

A fake Home Assistant pushes state_changed events in bursts (SW_CORE10_EVENTS, default 5,000, in bursts of 1,000 at about
5,000 events/s) into the real HaSync session. The fake socket reader does what `ha_client.ws_session`'s reader does: it takes one
frame at a time and calls the session's `on_event` synchronously on the session's event loop. Arriving frames are produced by a
separate thread (Home Assistant is another process: frames keep arriving while the loop is busy), so the frames waiting to be read
are the socket backlog.

The burst carries the two slow things of the finding: a rule with a Home Assistant notify action fires on every 100th door
transition and Home Assistant answers it slowly (SLOW_NOTIFY_S), and once, during the third burst, another writer holds the
database write lock for LOCK_HOLD_S (a backup, a migration step - CORE-05).

Measured (printed as `CORE10_EVIDENCE {...}`, written to SW_CORE10_EVIDENCE when set):
- handler_*: how long one `on_event` call kept the reader (the loop) busy;
- loop_lag_*: how late a 5 ms timer on the session loop fired (what a ping, a pending `ws_call` reply, the debounced refresh wait);
- reply_*: the round trip of a request thread's call onto the session loop (`HaSync.ws_call`'s path: schedules, "refresh from
  Home Assistant", detect-by-pressing);
- socket_depth_max: frames Home Assistant had sent that the reader had not read yet;
- worker_depth_max: frames handed to the state worker and not applied yet (after the change only);
- mirror_lag_*: from the frame's arrival to its row being stored and pushed (on_state_changed done).

The bounds asserted are the ones the change must meet (they fail before it: the handler and the loop stall for the slow notify
and the held lock). Wall-clock and load-sensitive: timing lane (`-m timing_lane`), run on the runner."""
# the shared fixture imported from its module is the test function's argument (pytest injects it):
# ruff: noqa: F811
from __future__ import annotations

import asyncio
import json
import os
import statistics
import threading
import time
from typing import Any

import pytest
from conftest import sw_time_factor

from smplwise.services import ha_client, ha_sync
from smplwise.services import rules as rules_svc
from test_ha_structure_refresh import FakeHa, app_s, fast  # noqa: F401 - the shared fixtures

pytestmark = pytest.mark.timing_lane

EVENTS = int(os.environ.get("SW_CORE10_EVENTS", "5000"))
BURST = min(1000, EVENTS)
RATE_PER_S = 5000  # Home Assistant's send rate inside a burst
PAUSE_S = 1.0  # between bursts
SLOW_NOTIFY_S = 0.3  # a slow Home Assistant answering the rule's notify call
FIRE_EVERY = 100  # every 100th door transition fires the rule
LOCK_HOLD_S = 1.5  # another writer holds the write lock once, during the third burst
DOORS, SENSORS, LIGHTS = 200, 200, 100
BASE = 1795000000.0  # 2026-11-17, an arbitrary fixed instant for last_changed


def _iso(n: int) -> str:
    import datetime as dt

    return dt.datetime.fromtimestamp(BASE + n / 1000.0, dt.timezone.utc).isoformat()


def _entities() -> list[tuple[str, dict[str, Any]]]:
    out = [(f"binary_sensor.door_{i}", {"friendly_name": f"Door {i}", "device_class": "door"}) for i in range(DOORS)]
    out += [(f"sensor.power_{i}", {"friendly_name": f"Power {i}", "device_class": "power", "unit_of_measurement": "W"}) for i in range(SENSORS)]
    out += [(f"light.l_{i}", {"friendly_name": f"Light {i}"}) for i in range(LIGHTS)]
    return out


def _pct(values: list[float], q: float) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    return s[min(len(s) - 1, int(q * len(s)))]


def _ms(v: float) -> float:
    return round(v * 1000.0, 1)


def test_core10_state_burst_keeps_the_reader_and_the_loop_free(app_s, monkeypatch):
    app, s = app_s
    db = app.state.db
    fake = FakeHa()
    ents = _entities()
    states: dict[str, dict[str, Any]] = {}
    for n, (eid, attrs) in enumerate(ents):
        st = {"entity_id": eid, "state": "off" if not eid.startswith("sensor.") else "0", "attributes": attrs, "last_changed": _iso(-1 - n), "last_updated": _iso(-1 - n)}
        states[eid] = st
        fake.states.append(st)

    # the rule with a notify action, answered slowly by Home Assistant
    notify_calls: list[float] = []
    door_transitions = [0]
    real_evaluate = rules_svc.evaluate_event

    def evaluate_event(conn, transition, deliver=True):  # noqa: ARG001 - the real signature
        door_transitions[0] += 1
        if door_transitions[0] % FIRE_EVERY:
            return []
        return [{"_pending": [("mobile_app_owner", "door", "core10")], "ha_notify": {}, "announce": []}]

    def slow_notify(service: str, message: str, title: str) -> str:  # noqa: ARG001
        time.sleep(SLOW_NOTIFY_S)
        notify_calls.append(time.perf_counter())
        return "sent"

    monkeypatch.setattr(rules_svc, "evaluate_event", evaluate_event)
    monkeypatch.setattr(rules_svc, "HA_NOTIFY", slow_notify)
    assert real_evaluate is not evaluate_event

    # when each frame arrived (by its unique state value) and when its row was stored and pushed
    sent_at: dict[tuple[str, str], float] = {}
    done_at: dict[tuple[str, str], float] = {}
    real_on_state_changed = ha_sync.on_state_changed

    def on_state_changed(db_, data, *args, **kw):
        row = real_on_state_changed(db_, data, *args, **kw)
        new = data.get("new_state") or {}
        done_at[(str(new.get("entity_id")), str(new.get("state")) + "|" + str(new.get("last_changed")))] = time.perf_counter()
        return row

    monkeypatch.setattr(ha_sync, "on_state_changed", on_state_changed)

    m: dict[str, Any] = {"handler": [], "loop_lag": [], "reply": [], "socket_depth_max": 0, "worker_depth_max": 0}
    last_sent: dict[str, str] = {}
    counters = {"sent": 0, "read": 0}

    async def ws_session(_settings, on_ready, on_event, stop, on_message=None):  # noqa: ARG001
        loop = asyncio.get_running_loop()
        await on_ready(fake.call)
        socket_q: asyncio.Queue = asyncio.Queue()
        running = [True]

        async def reader() -> None:  # ha_client.ws_session's reader: one frame at a time, the handler called synchronously
            while True:
                item = await socket_q.get()
                if item is None:
                    return
                counters["read"] += 1
                t0 = time.perf_counter()
                on_event(item)
                m["handler"].append(time.perf_counter() - t0)

        async def ticker() -> None:
            while running[0]:
                t = time.perf_counter()
                await asyncio.sleep(0.005)
                m["loop_lag"].append(max(0.0, time.perf_counter() - t - 0.005))

        def probe() -> None:  # a request thread's call onto the session loop (HaSync.ws_call)
            while running[0]:
                t = time.perf_counter()
                try:
                    asyncio.run_coroutine_threadsafe(asyncio.sleep(0), loop).result(timeout=60)
                except Exception:  # noqa: BLE001 - the loop ended
                    return
                m["reply"].append(time.perf_counter() - t)
                time.sleep(0.02)

        def hold_lock() -> None:
            with db.connection(label="core10.lock_holder"):
                time.sleep(LOCK_HOLD_S)

        def produce() -> None:
            n = 0
            per_tick = max(1, RATE_PER_S // 100)
            for b in range(0, EVENTS, BURST):
                if b // BURST == 2:
                    threading.Thread(target=hold_lock, name="core10-lock-holder", daemon=True).start()
                end = min(EVENTS, b + BURST)
                while n < end:
                    for _ in range(min(per_tick, end - n)):
                        eid, _attrs = ents[n % len(ents)]
                        old = dict(states[eid])
                        if eid.startswith("sensor."):
                            value = str(n)
                        else:
                            value = "on" if old["state"] == "off" else "off"
                        new = {**old, "state": value, "last_changed": _iso(n), "last_updated": _iso(n)}
                        states[eid].update(new)  # what a re-read of the states would return now
                        last_sent[eid] = value
                        sent_at[(eid, value + "|" + new["last_changed"])] = time.perf_counter()
                        counters["sent"] += 1
                        m["socket_depth_max"] = max(m["socket_depth_max"], counters["sent"] - counters["read"])
                        worker = getattr(ha_sync, "STATE_WORKER", None)
                        if worker is not None:
                            m["worker_depth_max"] = max(m["worker_depth_max"], worker.depth())
                        loop.call_soon_threadsafe(socket_q.put_nowait, {"entity_id": eid, "old_state": old, "new_state": new})
                        n += 1
                    time.sleep(0.01)
                time.sleep(PAUSE_S)
            loop.call_soon_threadsafe(socket_q.put_nowait, None)

        tick = asyncio.create_task(ticker())
        probe_t = threading.Thread(target=probe, name="core10-probe", daemon=True)
        probe_t.start()
        started = time.perf_counter()
        producer = threading.Thread(target=produce, name="core10-producer", daemon=True)
        producer.start()
        await reader()
        m["read_all_s"] = time.perf_counter() - started
        deadline = time.perf_counter() + 180 * sw_time_factor()
        while len(done_at) < EVENTS and time.perf_counter() < deadline:
            await asyncio.sleep(0.05)
        m["applied_all_s"] = time.perf_counter() - started
        running[0] = False
        await tick
        await asyncio.get_running_loop().run_in_executor(None, probe_t.join, 5)

    monkeypatch.setattr(ha_client, "ws_session", ws_session)
    sync = ha_sync.HaSync()
    sync.db, sync.settings = db, s
    asyncio.run(sync._session(asyncio.Event()))

    # the delivery of the slow notifications may still be running (after the change it is off the state path)
    expected_fires = door_transitions[0] // FIRE_EVERY
    deadline = time.perf_counter() + 60
    while len(notify_calls) < expected_fires and time.perf_counter() < deadline:
        time.sleep(0.05)

    lags = [done_at[k] - sent_at[k] for k in done_at if k in sent_at]
    worker = getattr(ha_sync, "STATE_WORKER", None)
    evidence = {
        "events": EVENTS, "burst": BURST, "rate_per_s": RATE_PER_S, "slow_notify_s": SLOW_NOTIFY_S, "lock_hold_s": LOCK_HOLD_S,
        "rule_fires": expected_fires, "notify_sent": len(notify_calls),
        "handler_max_ms": _ms(max(m["handler"], default=0.0)), "handler_p99_ms": _ms(_pct(m["handler"], 0.99)),
        "handler_mean_ms": _ms(statistics.fmean(m["handler"]) if m["handler"] else 0.0),
        "loop_lag_max_ms": _ms(max(m["loop_lag"], default=0.0)), "loop_lag_p99_ms": _ms(_pct(m["loop_lag"], 0.99)),
        "reply_max_ms": _ms(max(m["reply"], default=0.0)), "reply_p99_ms": _ms(_pct(m["reply"], 0.99)),
        "socket_depth_max": m["socket_depth_max"],
        "worker_depth_max": max(m["worker_depth_max"], worker.max_depth if worker is not None else 0),
        "mirror_lag_max_ms": _ms(max(lags, default=0.0)), "mirror_lag_p95_ms": _ms(_pct(lags, 0.95)),
        "applied": len(done_at), "read_all_s": round(m["read_all_s"], 2), "applied_all_s": round(m["applied_all_s"], 2),
        "overflows": getattr(ha_sync.STATE, "state_overflows", None), "resyncs": getattr(ha_sync.STATE, "state_resyncs", None),
        "with_worker": worker is not None,
    }
    print("\nCORE10_EVIDENCE " + json.dumps(evidence, sort_keys=True))
    out = os.environ.get("SW_CORE10_EVIDENCE")
    if out:
        with open(out, "w", encoding="utf-8") as fh:
            json.dump(evidence, fh, indent=1, sort_keys=True)

    # nothing lost, in order: every entity ends at the last state Home Assistant sent for it
    with db.connection(mode="read") as conn:
        stored = {r["entity_id"]: r["state"] for r in conn.execute("SELECT entity_id, state FROM ha_entities")}
    wrong = {eid: (stored.get(eid), v) for eid, v in last_sent.items() if stored.get(eid) != v}
    assert not wrong, f"{len(wrong)} entities not at their last state, e.g. {list(wrong.items())[:3]}"
    assert len(done_at) == EVENTS
    assert len(notify_calls) == expected_fires, "every fired rule's notification was delivered"

    f = sw_time_factor()
    # the change's bounds: the reader hands a frame on in well under a millisecond and the loop stays responsive while the
    # notifications are slow and the database is locked (before the change: >= SLOW_NOTIFY_S and >= LOCK_HOLD_S)
    assert evidence["handler_max_ms"] < 50 * f, evidence
    assert evidence["loop_lag_max_ms"] < 250 * f, evidence
    assert evidence["reply_max_ms"] < 250 * f, evidence
