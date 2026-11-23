"""T068-EDGE-2450 (second pass): what test_soak_edges_2450.py did not reach, on fakes and temporary folders only.

1. A REAL full database. The first pass fakes SQLITE_FULL with a connection shim. Here SQLite itself refuses: every connection of the
   add-on is opened with `PRAGMA max_page_count` = its current size, so a filler table grows until SQLite answers "database or disk
   is full" from its own page allocator (statement time or commit time, whichever it is) - the same error code and the same
   code path a full volume gives, without a mount (the server has no root and no user namespaces). `shutil.disk_usage` is NOT
   faked: it keeps reporting free space, which is what a quota or a size-limited volume looks like. Checked: the API's error
   envelope on several write routes, reads and /healthz still answering, the health summary and the administrator's report say
   why (the second signal added by this row), the ingest queue stays bounded and accounted for, and once space returns writes
   work, the warning clears by itself, committed rows are intact and `integrity_check` is ok.
2. Home Assistant dropping and coming back with live /ha/ws subscribers (three cycles, 25 pushes in each): every push is delivered once,
   the connection-state frames are exactly [disconnected, connected] per cycle, no subscriber is left behind, no queue grows.
3. A stalled /events/ws and /ha/ws subscriber (never reads) while events keep coming: its queue stays at its cap, ingest never
   blocks, and the loss is counted.
4. The NVR delivering the same alert again after a reconnect: one event row, not two.

Each test prints one `T068_EDGE {json}` line (`pytest -rA -s`)."""
from __future__ import annotations

import datetime as dt
import json
import queue
import sqlite3
import threading
import time
from dataclasses import replace
from typing import Any

import pytest
from fastapi.testclient import TestClient
from test_soak_edges_2450 import (  # noqa: F401 - imported fixtures
    ScriptedHa,
    _alert,
    _events,
    _mirror,
    _state,
    ingest_state_saved,
    integrity,
    own_threads,
    record,
    report_checks,
    summary_items,
)

from smplwise import db as dbmod
from smplwise.main import create_app
from smplwise.services import events_ingest, ha_client, ha_sync
from support.waiting import wait_for

CAP: dict[str, int | None] = {"pages": None}


@pytest.fixture()
def real_size_cap(monkeypatch):
    """Every connection the add-on opens from now on is limited to CAP["pages"] database pages (None: unlimited)."""
    real_open = dbmod.Database._open

    def _open(self, durable: bool = True):
        conn = real_open(self, durable)
        if CAP["pages"] is not None:
            conn.execute(f"PRAGMA max_page_count={int(CAP['pages'])}")
        return conn

    monkeypatch.setattr(dbmod.Database, "_open", _open)
    CAP["pages"] = None
    yield CAP
    CAP["pages"] = None


def _page_count(db: Any) -> int:
    with db.connection(mode="read") as conn:
        return int(conn.execute("PRAGMA page_count").fetchone()[0])


def _fill_until_full(db: Any) -> int:
    """Grow a filler table in 16 KB rows until SQLite itself refuses; returns the rows that were committed."""
    kept = 0
    while True:
        try:
            with db.connection() as conn:
                conn.execute("INSERT INTO edge_filler(b) VALUES (zeroblob(16384))")
            kept += 1
        except sqlite3.OperationalError as exc:
            assert dbmod.is_storage_full(exc), f"SQLite refused for another reason: {exc}"
            return kept
        assert kept < 500, "the size cap never stopped the filler"


ENVELOPE = {"code", "user_message", "retryable", "correlation_id", "details"}


def test_g1_a_real_full_database_under_load(settings, monkeypatch, real_size_cap, ingest_state_saved):
    monkeypatch.setattr(dbmod, "STORAGE_REFUSAL_WINDOW_S", 2.0)
    s = replace(settings, nvr_host="nvr.test", nvr_user="u", nvr_password="p")
    app = create_app(s)
    c = TestClient(app)
    db = app.state.db
    assert c.get("/api/v1/events").status_code == 200  # the first request writes the bootstrap grant
    with db.connection() as conn:
        conn.execute("CREATE TABLE edge_filler(id INTEGER PRIMARY KEY, b BLOB)")
    q = events_ingest.IngestQueue()
    listener = events_ingest.AlertStreamListener(recorder_id="nvr-edge", state=events_ingest.IngestState(), ingest_queue=q)
    listener.db, listener.settings, listener.tz_getter = db, s, lambda: "Asia/Jerusalem"
    listener.writer = threading.Thread(target=listener._drain, args=(listener.generation,), name="alertstream-writer-edge", daemon=True)
    listener.writer.start()
    t0 = dt.datetime.now(dt.timezone(dt.timedelta(hours=2))).replace(microsecond=0) - dt.timedelta(hours=3)
    try:
        # healthy
        for i in range(3):
            listener.submit(_alert(i + 1, t0 + dt.timedelta(minutes=10 * i)))
        wait_for(lambda: q.stats()["processed"] == 3, timeout=5, what="healthy alerts stored")
        committed = {e["id"] for e in _events(db)}
        assert len(committed) == 3 and "storage" not in summary_items(c)
        assert dbmod.recent_storage_refusal_age() is None

        # the fault: the database may not grow any more, and then it is filled for real
        CAP["pages"] = _page_count(db) + 24
        db.invalidate_pool()
        filler_rows = _fill_until_full(db)
        assert filler_rows >= 1
        for i in range(40):  # alerts that need new pages: some rows still fit into the slack of the last pages, so there are many
            listener.submit(_alert(i % 8 + 1, t0 + dt.timedelta(hours=1, minutes=10 * i)))
        wait_for(lambda: q.stats()["failed"] >= 1 and q.stats()["depth"] == 0, timeout=15, what="alerts refused by the full database")
        assert listener.writer.is_alive(), "the alert writer survives a full database"

        # the add-on stays up and answers properly
        assert c.get("/healthz").status_code == 200
        assert c.get("/api/v1/events").status_code == 200, "reads keep working"
        refusals = []
        for method, url, body in (("patch", "/api/v1/settings", {"storage.min_free_mb": 900}),
                                  ("patch", "/api/v1/settings", {"events.retention_days": 400}),
                                  ("post", "/api/v1/events/ack-many", {"ids": sorted(committed)[:1]})):
            r = getattr(c, method)(url, json=body)
            refusals.append((url, r.status_code, r.json().get("code")))
            if r.status_code == 507:
                assert set(r.json()) >= ENVELOPE and r.json()["code"] == "storage_full" and r.json()["retryable"] is False, r.text
        assert refusals[0][1] == 507, refusals
        assert all(code in (507, 422, 403, 404, 200) for _u, code, _c in refusals), refusals
        # the health signals: disk_usage still shows free space (not faked) - the refusal itself is what says it
        item = summary_items(c).get("storage")
        assert item is not None and item["status"] == "error" and "מסרב" in item["label"], item
        check = report_checks(c)["storage"]
        assert check["status"] == "error" and "נדחתה" in check["detail"], check
        q_while_full = q.stats()
        assert q_while_full["depth"] == 0 and q_while_full["high_water"] <= q.maxlen
        assert q_while_full["accepted"] == q_while_full["processed"] + q_while_full["failed"] + q_while_full["coalesced"] + q_while_full["dropped"] + q_while_full["depth"], q_while_full
        # the HA state feed's writer fails the same clean way (the session logs it and goes on)
        with pytest.raises(sqlite3.OperationalError) as exc_info:
            for i in range(60):
                ha_sync.on_state_changed(db, {"entity_id": f"sensor.edge_{i}", "old_state": None,
                                              "new_state": {**_state(f"sensor.edge_{i}", "x" * 3000, "2026-11-24T09:00:00+00:00"), "attributes": {"blob": "y" * 3000}}})
        assert dbmod.is_storage_full(exc_info.value)

        # space returns
        CAP["pages"] = None
        db.invalidate_pool()
        for i in range(2):
            listener.submit(_alert(i + 20, t0 + dt.timedelta(days=1, minutes=10 * i)))
        wait_for(lambda: q.stats()["processed"] == q_while_full["processed"] + 2, timeout=10, what="stored again once space is back")
        again = c.patch("/api/v1/settings", json={"storage.min_free_mb": 900})
        assert again.status_code == 200, again.text
        wait_for(lambda: "storage" not in summary_items(c), timeout=10, what="the storage warning clears on its own")
        assert report_checks(c)["storage"]["status"] == "ok"
        with db.connection(mode="read") as conn:
            filler_after = conn.execute("SELECT COUNT(*) FROM edge_filler").fetchone()[0]
    finally:
        listener.stop.set()
        listener.generation += 1
        listener.writer.join(timeout=8)
    after = {e["id"] for e in _events(db)}
    assert committed <= after, "rows committed before the fault are kept"
    assert filler_after == filler_rows, "what the filler committed is intact, what it was refused is absent"
    stats = q.stats()
    assert stats["accepted"] == stats["processed"] + stats["failed"] + stats["coalesced"] + stats["dropped"] + stats["depth"], stats
    assert integrity(db) == "ok"
    record("G1 real full database", filler_rows=filler_rows, refusals=refusals, queue=stats, summary=item["label"])


def test_g2_ha_drop_with_live_subscribers_three_cycles(settings, monkeypatch):
    started_before = frozenset(t.ident for t in threading.enumerate())
    monkeypatch.setattr(ha_sync, "BACKOFF_START_S", 0.05)
    monkeypatch.setattr(ha_sync, "BACKOFF_MAX_S", 0.2)
    monkeypatch.setattr(ha_sync, "RESTART_BACKOFF_CAP_S", 0.2)
    monkeypatch.setattr(ha_sync, "REGISTRY_DEBOUNCE_S", 0.05)
    s = replace(settings, ha_url="http://ha.test:8123", ha_token="edge-token")
    app = create_app(s)
    db = app.state.db
    ha = ScriptedHa()
    monkeypatch.setattr(ha_client, "ws_session", ha.ws_session)
    sync = ha_sync.HaSync()
    subs_before = len(ha_sync._subscribers)
    sub = ha_sync.subscribe()
    frames: list[dict[str, Any]] = []

    def drain() -> None:
        while True:
            try:
                frames.append(sub.get_nowait())
            except queue.Empty:
                return

    per_cycle: list[dict[str, Any]] = []
    sync.start(db, s)
    try:
        wait_for(lambda: ha_sync.STATE.connected and ha.ready == 1, timeout=10, what="first connect")
        for cycle in range(3):
            drain()
            frames.clear()
            at = f"2026-11-24T10:0{cycle}:00+00:00"
            for i in range(25):
                eid = f"sensor.burst_{cycle}_{i}"
                ha.events.put({"entity_id": eid, "old_state": None, "new_state": _state(eid, f"v{cycle}", at)})
            wait_for(lambda cycle=cycle: _mirror(db, f"sensor.burst_{cycle}_24") == f"v{cycle}", timeout=10, what="burst stored")
            ha.down = True
            attempts = ha.attempts
            ha.drop.set()
            wait_for(lambda: not ha_sync.STATE.connected and ha.attempts >= attempts + 2, timeout=10, what="down")
            ha.down = False
            wait_for(lambda cycle=cycle: ha_sync.STATE.connected and ha.ready == cycle + 2, timeout=10, what="back")
            time.sleep(0.2)
            drain()
            pushed = [f for f in frames if f.get("type") == "entity_state_changed"]
            states = [f["connected"] for f in frames if f.get("type") == "ha_sync_state"]
            ids = [f["entity"]["entity_id"] for f in pushed if f["entity"]["entity_id"].startswith("sensor.burst_")]
            assert sorted(ids) == sorted(f"sensor.burst_{cycle}_{i}" for i in range(25)), "every push exactly once, none replayed after the reconnect"
            assert states == [False, True], states
            assert sub.qsize() == 0
            per_cycle.append({"cycle": cycle, "pushes": len(ids), "state_frames": states, "threads": own_threads(started_before)})
        assert all(x["threads"] == per_cycle[0]["threads"] for x in per_cycle), per_cycle
    finally:
        ha_sync.unsubscribe(sub)
        sync.shutdown()
    assert len(ha_sync._subscribers) == subs_before, "no subscriber left behind"
    assert integrity(db) == "ok"
    record("G2 HA drop with live subscribers x3", cycles=per_cycle)


def test_g3_a_stalled_subscriber_never_grows_its_queue_or_blocks_ingest(settings, ingest_state_saved):
    subs_before = (len(events_ingest._subscribers), len(ha_sync._subscribers))
    ev_q, ha_q = events_ingest.subscribe(), ha_sync.subscribe()
    try:
        drops_before = events_ingest.STATE.ws_drops
        started = time.monotonic()
        for i in range(1000):
            events_ingest.publish({"id": f"e{i}", "occurred_at": "2026-11-24T10:00:00+00:00"})
            ha_sync.publish({"type": "entity_state_changed", "sequence": i, "entity": {"entity_id": f"sensor.s{i}"}})
        took = time.monotonic() - started
        assert ev_q.qsize() <= 200 and ha_q.qsize() <= 500, (ev_q.qsize(), ha_q.qsize())
        assert events_ingest.STATE.ws_drops - drops_before == 800, "the events feed counts what the stalled socket lost"
        assert took < 5, f"publishing blocked on a stalled subscriber ({took:.1f}s)"
        first = ev_q.get_nowait()
        assert first["id"] == "e0", "what is kept is the oldest 200 (the client reloads the list after a gap)"
    finally:
        events_ingest.unsubscribe(ev_q)
        ha_sync.unsubscribe(ha_q)
    assert (len(events_ingest._subscribers), len(ha_sync._subscribers)) == subs_before
    record("G3 stalled subscriber", events_queue=200, ha_queue=500, publish_1000_seconds=round(took, 3))


def test_g4_the_nvr_delivering_the_same_alert_again_after_a_reconnect(settings, ingest_state_saved):
    s = replace(settings, nvr_host="nvr.test", nvr_user="u", nvr_password="p")
    app = create_app(s)
    db = app.state.db
    TestClient(app).get("/api/v1/events")
    q = events_ingest.IngestQueue()
    listener = events_ingest.AlertStreamListener(recorder_id="nvr-edge", state=events_ingest.IngestState(), ingest_queue=q)
    listener.db, listener.settings, listener.tz_getter = db, s, lambda: "Asia/Jerusalem"
    listener.writer = threading.Thread(target=listener._drain, args=(listener.generation,), name="alertstream-writer-edge", daemon=True)
    listener.writer.start()
    when = dt.datetime.now(dt.timezone(dt.timedelta(hours=2))).replace(microsecond=0) - dt.timedelta(hours=1)
    try:
        listener.submit(_alert(3, when))
        wait_for(lambda: q.stats()["processed"] == 1, timeout=5, what="first delivery")
        listener.submit(_alert(3, when))  # the stream reconnects and the device sends the same alert (same device time) again
        wait_for(lambda: q.stats()["processed"] == 2, timeout=5, what="second delivery")
    finally:
        listener.stop.set()
        listener.generation += 1
        listener.writer.join(timeout=8)
    rows = _events(db, "type != 'coverage_gap'")
    assert len(rows) == 1, f"one event row for one alert, got {len(rows)}"
    with db.connection(mode="read") as conn:
        count = conn.execute("SELECT count FROM events WHERE id = ?", (rows[0]["id"],)).fetchone()[0]
    assert integrity(db) == "ok"
    record("G4 same alert delivered twice", rows=len(rows), count=count, details=json.loads(rows[0]["details_json"]).get("description"))
