"""M024 / T024: the 1,000-entity fixture. The real HaSync session against a generated fake Home Assistant carrying 1,000
entities (registry, devices, 20 areas on 4 floors), through a first connect, a disconnect, a change set made while the
link was down (states moved, entities deleted, new ones, area moves) and the return; then a burst of 1,000 live
state_changed events. Asserts correctness (counts, tombstones, freshness, area mirror, tree sums, list endpoint) and
prints the measured durations / memory (run with `-s`; numbers also land in SW_M024_EVIDENCE if that path is set).

Bounds are generous (a busy shared runner) and scale with SW_TEST_TIME_FACTOR; the measured numbers are the evidence.
"""
from __future__ import annotations

import copy
import json
import os
try:
    import resource
except ImportError:  # Windows: the runner (Linux) is where the numbers are taken
    resource = None
import time
import tracemalloc
from dataclasses import replace
from typing import Any

import pytest
from conftest import sw_time_factor
from fastapi.testclient import TestClient

from smplwise.services import ha_sync
from test_ha_structure_refresh import FakeHa, app_s, fast, registry_event, run_session  # noqa: F401  (fixtures)

N = 1000
DOMAINS = ["light", "switch", "sensor", "binary_sensor", "cover", "climate", "lock", "media_player", "camera", "fan"]
FLOOR_COUNT, AREA_COUNT = 4, 20
STAMP = "2026-10-05T08:00:00+00:00"
EVIDENCE: dict[str, Any] = {}


def _state(eid: str, state: str, n: int) -> dict[str, Any]:
    domain = eid.split(".", 1)[0]
    attrs: dict[str, Any] = {"friendly_name": f"Entity {n}"}
    if domain == "light":
        attrs["brightness"] = 128
    if domain == "sensor":
        attrs.update(unit_of_measurement="W", device_class="power")
    return {"entity_id": eid, "state": state, "attributes": attrs, "last_changed": STAMP, "last_updated": STAMP}


def build_world() -> tuple[FakeHa, list[str]]:
    fake = FakeHa()
    fake.floors = [{"floor_id": f"fl{i}", "name": f"Floor {i}", "level": i, "icon": None} for i in range(FLOOR_COUNT)]
    fake.areas = [{"area_id": f"ar{i}", "name": f"Area {i}", "floor_id": f"fl{i % FLOOR_COUNT}", "icon": None} for i in range(AREA_COUNT)]
    fake.devices = [{"id": f"dev{i}", "area_id": f"ar{i % AREA_COUNT}"} for i in range(100)]
    fake.entities, fake.states, ids = [], [], []
    for n in range(N):
        eid = f"{DOMAINS[n % len(DOMAINS)]}.e{n:04d}"
        ids.append(eid)
        entry = {"entity_id": eid, "id": f"reg-{n}", "unique_id": f"u{n}", "platform": "fake", "entity_category": None}
        if n % 2:  # half resolve their area through their device (the device rule), half carry it themselves
            entry.update(area_id=None, device_id=f"dev{n % 100}")
        else:
            entry.update(area_id=f"ar{n % AREA_COUNT}", device_id=None)
        fake.entities.append(entry)
        fake.states.append(_state(eid, "on" if n % 3 == 0 else "off", n))
    return fake, ids


def area_of_entity(fake: FakeHa, eid: str) -> str | None:
    e = next(x for x in fake.entities if x["entity_id"] == eid)
    if e["area_id"]:
        return e["area_id"]
    return next((d["area_id"] for d in fake.devices if d["id"] == e["device_id"]), None)


def expected_area_counts(fake: FakeHa) -> dict[str, int]:
    live = {s["entity_id"] for s in fake.states}
    out: dict[str, int] = {}
    for e in fake.entities:
        if e["entity_id"] in live:
            a = area_of_entity(fake, e["entity_id"])
            out[a] = out.get(a, 0) + 1
    return out


def tree_counts(c: TestClient) -> dict[str, int]:
    t = c.get("/api/v1/devices/tree").json()
    return {a["area_id"]: a["counts"]["entities"] for f in t["floors"] for a in f["areas"]}


def listing(c: TestClient) -> tuple[list[dict[str, Any]], float]:
    t0 = time.perf_counter()
    r = c.get("/api/v1/ha/entities?limit=2000")
    dt = time.perf_counter() - t0
    assert r.status_code == 200
    return r.json()["entities"], dt


def rss_mb() -> float:
    return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024 if resource else -1.0  # Linux: KiB


def test_1000_entities_connect_disconnect_return(app_s, monkeypatch):
    app, s = app_s
    c = TestClient(app)
    fake, ids = build_world()
    f = sw_time_factor()
    tracemalloc.start()

    # ---- 1. first connect: registry -> states -> subscribe
    async def noop(on_event, on_message, settle):
        await settle(1)

    t0 = time.perf_counter()
    run_session(app, s, fake, noop, monkeypatch)
    EVIDENCE["connect_1000_s"] = round(time.perf_counter() - t0, 3)
    assert EVIDENCE["connect_1000_s"] < 30 * f
    assert ha_sync.STATE.connected is True and ha_sync.STATE.entities == N
    assert fake.subscribed.count("state_changed") == 1
    ents, dt = listing(c)
    EVIDENCE["list_1000_s"] = round(dt, 3)
    assert len(ents) == N and all(e["fresh"] for e in ents) and all(e["area_id"] for e in ents)
    t0 = time.perf_counter()
    counts = tree_counts(c)
    EVIDENCE["tree_s"] = round(time.perf_counter() - t0, 3)
    assert counts == expected_area_counts(fake) and sum(counts.values()) == N
    assert EVIDENCE["list_1000_s"] < 10 * f and EVIDENCE["tree_s"] < 10 * f

    # ---- 2. the link drops: nothing is invented, nothing is lost
    before = {e["entity_id"]: (e["state"], e["last_changed"], e["state_seen_at"]) for e in ents}
    ha_sync.STATE.connected = False  # what HaSync._loop does when ws_session ends
    ents_down, dt = listing(c)
    EVIDENCE["list_1000_disconnected_s"] = round(dt, 3)
    assert len(ents_down) == N
    assert not any(e["fresh"] for e in ents_down), "stale entities must never be reported fresh while disconnected"
    assert {e["entity_id"]: (e["state"], e["last_changed"], e["state_seen_at"]) for e in ents_down} == before
    assert tree_counts(c) == counts  # the tree keeps the last known world

    # ---- 3. HA changes while we are away: 100 states, 20 deletions, 30 new entities, 10 area moves
    changed = ids[0:100]
    for st in fake.states:
        if st["entity_id"] in changed:
            st["state"] = "unavailable" if st["state"] == "on" else "on"
            st["last_changed"] = st["last_updated"] = "2026-10-05T09:00:00+00:00"
    deleted = ids[900:920]
    fake.states = [s_ for s_ in fake.states if s_["entity_id"] not in deleted]
    fake.entities = [e for e in fake.entities if e["entity_id"] not in deleted]
    added = []
    for k in range(30):
        eid = f"light.new{k:03d}"
        added.append(eid)
        fake.entities.append({"entity_id": eid, "id": f"regn-{k}", "area_id": f"ar{k % AREA_COUNT}", "device_id": None, "entity_category": None})
        fake.states.append(_state(eid, "on", N + k))
    moved = ids[200:210]
    for e in fake.entities:
        if e["entity_id"] in moved:
            e.update(area_id="ar19", device_id=None)

    t0 = time.perf_counter()
    run_session(app, s, fake, noop, monkeypatch)
    EVIDENCE["reconnect_resync_s"] = round(time.perf_counter() - t0, 3)
    assert EVIDENCE["reconnect_resync_s"] < 30 * f
    assert ha_sync.STATE.connected is True
    expected_total = N - len(deleted) + len(added)
    ents2, dt = listing(c)
    EVIDENCE["list_after_return_s"] = round(dt, 3)
    by = {e["entity_id"]: e for e in ents2}
    assert len(ents2) == expected_total == ha_sync.STATE.entities
    assert all(e["fresh"] for e in ents2)
    assert not set(deleted) & set(by) and set(added) <= set(by)
    assert all(by[e]["state"] == next(x["state"] for x in fake.states if x["entity_id"] == e) for e in changed)
    assert all(by[e]["area_id"] == "ar19" for e in moved)
    assert sum(1 for e in ents2 if e["entity_id"] in ids[100:900] and e["state"] == before[e["entity_id"]][0]) == 800  # untouched ones untouched
    # tombstoned, never deleted: the row stays (placements survive a flapping registry) and says when
    with app.state.db.connection(mode="read") as conn:
        gone = conn.execute("SELECT COUNT(*) FROM ha_entities WHERE removed_at IS NOT NULL").fetchone()[0]
        total_rows = conn.execute("SELECT COUNT(*) FROM ha_entities").fetchone()[0]
    assert gone == len(deleted) and total_rows == N + len(added)
    assert tree_counts(c) == expected_area_counts(fake)

    # ---- 4. a burst of 1,000 live events on the returned link
    live_ids = [s_["entity_id"] for s_ in fake.states][:N]
    seq0 = ha_sync.STATE.sequence

    async def burst(on_event, on_message, settle):
        for i, eid in enumerate(live_ids):
            on_event({"entity_id": eid, "old_state": None, "new_state": _state(eid, "burst", i) | {"last_changed": "2026-10-05T10:00:00+00:00", "last_updated": "2026-10-05T10:00:00+00:00"}})
        await settle(1)

    t0 = time.perf_counter()
    _, published = run_session(app, s, fake, burst, monkeypatch)
    EVIDENCE["burst_1000_events_s"] = round(time.perf_counter() - t0, 3)
    pushed = [m for m in published if m.get("type") == "entity_state_changed"]
    assert len(pushed) == len(live_ids) and ha_sync.STATE.sequence - seq0 == len(live_ids)
    assert [m["sequence"] for m in pushed] == list(range(seq0 + 1, seq0 + len(live_ids) + 1))  # strictly increasing: no gap, no reorder
    ents3, _ = listing(c)
    assert sum(1 for e in ents3 if e["state"] == "burst") == len(live_ids)
    assert EVIDENCE["burst_1000_events_s"] < 60 * f

    cur, peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    EVIDENCE["py_heap_peak_mb"] = round(peak / 1048576, 1)
    EVIDENCE["process_max_rss_mb"] = round(rss_mb(), 1)
    EVIDENCE["entities"] = N
    print("\nM024_EVIDENCE " + json.dumps(EVIDENCE, sort_keys=True))
    out = os.environ.get("SW_M024_EVIDENCE")
    if out:
        with open(out, "w", encoding="utf-8") as fh:
            json.dump(EVIDENCE, fh, indent=1, sort_keys=True)
