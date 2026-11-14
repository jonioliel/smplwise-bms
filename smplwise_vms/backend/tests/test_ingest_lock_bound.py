"""T068-INGEST-LOCK-2406: the alert stream's write transaction is bounded whatever the size of the events table.

The 15.6 h soak (docs/changes/T068-SOAK-2406.md) saw events_ingest._write hold the write lock for up to 17.5 s and other
writers (door_emergency.age_pending, elevators.tick) fail with "database is locked". Cause: store_alert's merge lookup
("the open row of this camera / kind last seen within DEDUP_WINDOW_S") had no index for its last-seen expression, so every
new burst scanned the whole events table under the lock. Migration 0207 adds a partial index over the open alert-stream
rows; these tests pin (1) the query plans, (2) a work bound independent of the table size, (3) the unchanged merge / close
semantics, and (4) that another writer gets the lock between the alerts of a large backlog without waiting long.
"""
from __future__ import annotations

import datetime as dt
import json
import sqlite3
import threading
import time
import uuid
from pathlib import Path

import pytest

from smplwise.db import Database
from smplwise.services import events_ingest as ei

TZ = "Asia/Jerusalem"
UTC = dt.timezone.utc


def _db(tmp_path: Path) -> Database:
    db = Database(tmp_path / "ingest.db", pool=False)
    db.migrate()
    return db


def _seed(db: Database, n: int, now: dt.datetime, open_rows: int = 0) -> None:
    """n closed motion rows on 8 channels going back in time (2 s apart, the newest a minute old), plus `open_rows`
    stale rows that never got their end (a Hikvision kind that sends no inactive)."""
    rows = []
    for i in range(n + open_rows):
        t = now - dt.timedelta(seconds=60 + i * 2)
        state = "active" if i >= n else "inactive"
        rows.append((uuid.uuid4().hex[:12], "alertstream", "VMD", "motion", None, 1 + i % 8, ei.iso_utc(t), ei.iso_utc(t + dt.timedelta(seconds=5)),
                     ei.iso_utc(t), state, 1, "info", "measured", json.dumps({"description": "x" * 200}), f"seed{i}", ei.iso_utc(t)))
    with db.connection() as conn:
        conn.executemany(
            "INSERT INTO events(id, source, raw_type, type, camera_id, channel, occurred_at, ended_at, received_at, state, count, severity, confidence, details_json, dedup_key, created_at)"
            " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", rows)


def _alert(when: dt.datetime, state: str = "active", ch: int = 3) -> ei.ParsedAlert:
    return ei.ParsedAlert(raw_type="VMD", state=state, channel=ch, dyn_channel=None, device_time=when.astimezone(UTC).isoformat(), description="", target="", active_post_count=1)


def _no_camera(_ch: int) -> None:
    return None


def _store_counting(db: Database, alert: ei.ParsedAlert, now: dt.datetime) -> tuple[dict | None, int, list[str]]:
    """store_alert in its own write transaction; returns the result, the SQLite VM steps (in units of 100) and the SQL run."""
    steps = [0]
    sql: list[str] = []
    with db.connection() as conn:
        conn.set_progress_handler(lambda: steps.__setitem__(0, steps[0] + 1) or 0, 100)
        conn.set_trace_callback(sql.append)
        try:
            out = ei.store_alert(conn, alert, TZ, _no_camera, now)
        finally:
            conn.set_progress_handler(None, 0)
            conn.set_trace_callback(None)
    return out, steps[0], sql


def test_merge_lookups_use_the_open_alert_index_not_a_table_scan(tmp_path):
    db = _db(tmp_path)
    now = dt.datetime.now(UTC).replace(microsecond=0)
    _seed(db, 500, now)
    _, _, sql_active = _store_counting(db, _alert(now), now)
    _, _, sql_inactive = _store_counting(db, _alert(now + dt.timedelta(seconds=2), "inactive"), now)
    lookups = [s for s in sql_active + sql_inactive if s.lstrip().upper().startswith("SELECT * FROM EVENTS WHERE SOURCE = 'ALERTSTREAM'")]
    assert len(lookups) == 2, lookups  # the active merge lookup and the inactive close lookup
    with db.connection("read") as conn:
        for q in lookups:
            plan = " | ".join(r[3] for r in conn.execute("EXPLAIN QUERY PLAN " + q).fetchall())
            assert "SCAN events" not in plan, plan
            assert "idx_events_alert_open" in plan or "idx_events_time" in plan, plan


@pytest.mark.parametrize("open_rows", [0, 2000])
def test_new_burst_costs_the_same_on_a_small_and_a_large_table(tmp_path, open_rows):
    """The soak's 548 MB database held hundreds of thousands of rows; the lookup's work must not grow with them (before
    0207 it was linear: ~414 ms at 200k rows on the workstation, many seconds on a starved disk). Stale open rows that never
    got an end must not make it grow either."""
    now = dt.datetime.now(UTC).replace(microsecond=0)
    small, large = _db(tmp_path / "s"), _db(tmp_path / "l")
    _seed(small, 1_000, now, open_rows=0)
    _seed(large, 40_000, now, open_rows=open_rows)
    ev_s, steps_s, _ = _store_counting(small, _alert(now), now)
    ev_l, steps_l, _ = _store_counting(large, _alert(now), now)
    assert ev_s and ev_l and ev_s["count"] == ev_l["count"] == 1  # a new row on both
    # 40x the rows: the work stays within a small constant (a full scan of 40k rows is > 4000 units of 100 steps)
    assert steps_l <= max(2 * steps_s, steps_s + 50), (steps_s, steps_l)
    # and closing it is bounded too
    _, close_l, _ = _store_counting(large, _alert(now + dt.timedelta(seconds=3), "inactive"), now)
    assert close_l <= max(2 * steps_s, steps_s + 50), (steps_s, close_l)


def test_merge_and_close_semantics_are_unchanged(tmp_path):
    db = _db(tmp_path)
    now = dt.datetime.now(UTC).replace(microsecond=0)
    _seed(db, 200, now)
    t0 = now - dt.timedelta(minutes=8)
    # a long burst: alerts every 20 s for 8 minutes stay ONE row (each within the window of the row's last-seen time,
    # although its occurred_at is minutes old)
    first, _, _ = _store_counting(db, _alert(t0), now)
    assert first
    t = t0
    for _ in range(24):
        t += dt.timedelta(seconds=20)
        ev, _, _ = _store_counting(db, _alert(t), now)
        assert ev and ev["id"] == first["id"]
    assert ev["count"] == 25 and ev["ended_at"] == ei.iso_utc(t)
    # a gap longer than the window starts a new row
    later, _, _ = _store_counting(db, _alert(t + dt.timedelta(seconds=ei.DEDUP_WINDOW_S + 5)), now)
    assert later and later["id"] != first["id"] and later["count"] == 1
    # inactive closes the newest open row of the camera / kind (occurred within 10 minutes)
    closed, _, _ = _store_counting(db, _alert(t + dt.timedelta(seconds=ei.DEDUP_WINDOW_S + 10), "inactive"), now)
    assert closed and closed["id"] == later["id"] and closed["state"] == "inactive"
    # the next inactive closes the older open row: its occurred_at (8+ minutes ago) is still inside 10 minutes
    closed2, _, _ = _store_counting(db, _alert(t + dt.timedelta(seconds=ei.DEDUP_WINDOW_S + 11), "inactive"), now)
    assert closed2 and closed2["id"] == first["id"]
    # an open row that started more than 10 minutes before the inactive is not closed (as before)
    old, _, _ = _store_counting(db, _alert(now - dt.timedelta(minutes=30), ch=4), now)
    none, _, _ = _store_counting(db, _alert(now - dt.timedelta(minutes=19), "inactive", ch=4), now)
    assert old and none is None
    # other cameras never merge
    other, _, _ = _store_counting(db, _alert(t + dt.timedelta(seconds=ei.DEDUP_WINDOW_S + 12), ch=5), now)
    assert other and other["id"] not in {first["id"], later["id"]}


def test_backlog_is_written_alert_by_alert_and_other_writers_get_the_lock_between(tmp_path, monkeypatch):
    """A large table and a burst backlog in the ingest queue: each alert is one short write transaction (bounded hold),
    and a writer of another module (like elevators.tick) is served between them without a long wait."""
    db = _db(tmp_path)
    now = dt.datetime.now(UTC).replace(microsecond=0)
    _seed(db, 30_000, now)
    with db.connection() as conn:
        conn.execute("CREATE TABLE probe_writes (at REAL)")
    q = ei.IngestQueue(maxlen=512)
    listener = ei.AlertStreamListener("rec-test", ei.IngestState(), q)
    listener.db = db
    listener.tz_getter = lambda: TZ
    monkeypatch.setattr(ei, "publish", lambda _ev: None)
    # 300 distinct episodes (8 channels, 5 kinds, spread 40 s apart so none coalesce) = 300 new rows, each a merge lookup
    kinds = ["VMD", "linedetection", "fielddetection", "regionEntrance", "regionExiting"]
    for i in range(300):
        when = now - dt.timedelta(seconds=40 * (300 - i))
        q.put(ei.ParsedAlert(raw_type=kinds[i % 5], state="active", channel=1 + i % 8, dyn_channel=None, device_time=when.isoformat(), description="",
                             target="", active_post_count=1))
    assert q.depth() == 300

    holds: list[float] = []
    real_handle = listener._handle

    def timed_handle(alert, repeats=0):
        t = time.perf_counter()
        real_handle(alert, repeats)
        holds.append(time.perf_counter() - t)  # the hold is inside this span

    listener._handle = timed_handle  # type: ignore[method-assign]
    stop = threading.Event()
    waits: list[float] = []

    def other_writer() -> None:
        while not stop.is_set():
            t = time.perf_counter()
            with db.connection(label="probe.tick") as conn:
                waits.append(time.perf_counter() - t)
                conn.execute("INSERT INTO probe_writes(at) VALUES (?)", (time.time(),))
            time.sleep(0.005)

    th = threading.Thread(target=other_writer, daemon=True)
    th.start()
    try:
        while (p := q.get(timeout=0)) is not None:
            listener._store_pending(p)
    finally:
        stop.set()
        th.join(timeout=10)
    s = q.stats()
    assert s["processed"] == 300 and s["failed"] == 0
    assert len(holds) == 300
    assert max(holds) < 1.0, f"one alert's transaction took {max(holds):.3f} s"
    assert len(waits) >= 10, "the other writer was starved during the backlog"
    assert max(waits) < 1.0, f"the other writer waited {max(waits):.3f} s"
    with db.connection("read") as conn:
        n = conn.execute("SELECT COUNT(*) FROM events WHERE source = 'alertstream' AND dedup_key LIKE 'as:%'").fetchone()[0]
    assert n == 300


def test_migration_0207_creates_the_index(tmp_path):
    db = _db(tmp_path)
    conn = sqlite3.connect(tmp_path / "ingest.db")
    try:
        sql = conn.execute("SELECT sql FROM sqlite_master WHERE type = 'index' AND name = 'idx_events_alert_open'").fetchone()
    finally:
        conn.close()
    assert sql and "source = 'alertstream'" in sql[0] and "state = 'active'" in sql[0]
    assert db.migrate() == []  # idempotent
