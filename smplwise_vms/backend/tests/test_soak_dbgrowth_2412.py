"""SOAK-DBGROWTH-2412: the 17.7 h soak of 2.40.7 (docs/changes/SOAK-DBGROWTH-2412.md).

Finding 1 - API p95 grew with the database while the host was idle: GET /events/facets ran one GROUP BY over every event
of the last 90 days (~490 ms at 677k rows, linear) and its cached answer was invalidated by every new row. Migration 0210
keeps per-day counts (events_facet_days) by triggers; the facets read whole days from it and count only the first,
partial day from the events table. Pinned here: the same numbers as the old query through inserts, deletes, updates and
the day boundary; a backfill equal to the table; work that does not grow with the size of older days.

Finding 2 - "database is locked" under a saturated host: the write lock was held for up to 61.9 s by the notification
monitor's camera pass (notify.faults: a lookup over every event of each camera in the last 24 h, under BEGIN IMMEDIATE)
and up to 22 s by GET /health (a read that ran on the write connection, COUNT(*) over the events table inside). Pinned
here: the camera pass walks the open-alert index (0207) with unchanged answers and bounded work; /health never takes the
write lock.
"""
from __future__ import annotations

import datetime as dt
import sqlite3
import threading
import time
import uuid
from pathlib import Path

from conftest import as_user
from smplwise.db import MIGRATIONS_DIR, Database
from smplwise.routers import events as events_router
from smplwise.services import notify_sources
from smplwise.services.timeutil import iso_utc

UTC = dt.timezone.utc
OLD_FACETS = "SELECT type, source, severity, camera_id, COUNT(*) AS n FROM events WHERE occurred_at >= ? GROUP BY type, source, severity, camera_id"


def _db(tmp_path: Path, name: str = "g.db") -> Database:
    tmp_path.mkdir(parents=True, exist_ok=True)
    db = Database(tmp_path / name, pool=False)
    db.migrate()
    return db


def _row(when: dt.datetime, *, source: str = "ha", type_: str = "motion", severity: str = "info", camera_id: str | None = None,
         state: str = "none", ended: dt.datetime | None = None) -> tuple:
    t = iso_utc(when)
    return (uuid.uuid4().hex[:16], source, "", type_, camera_id, None, t, iso_utc(ended) if ended else None, t, state, severity, uuid.uuid4().hex, t)


def _insert(conn: sqlite3.Connection, rows: list[tuple]) -> None:
    conn.executemany(
        "INSERT INTO events(id, source, raw_type, type, camera_id, channel, occurred_at, ended_at, received_at, state, severity, dedup_key, created_at)"
        " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", rows)


def _norm(rows) -> list[tuple]:
    return sorted((tuple(r) for r in rows), key=repr)


def _steps(conn: sqlite3.Connection, fn) -> tuple[object, int]:
    n = [0]
    conn.set_progress_handler(lambda: n.__setitem__(0, n[0] + 1) or 0, 100)
    try:
        out = fn()
    finally:
        conn.set_progress_handler(None, 0)
    return out, n[0]


# ---------------------------------------------------------------- finding 1: the facets

def test_facet_rows_match_the_old_group_by_through_every_kind_of_write(tmp_path):
    db = _db(tmp_path)
    now = dt.datetime(2026, 11, 9, 3, 50, tzinfo=UTC)
    since = iso_utc(now - dt.timedelta(days=90))
    rows = []
    # spread over 100 days (some before the period), two cameras and camera-less rows, several kinds; and rows on the
    # first day of the period both before and after `since` (the partial day)
    for i in range(1500):
        when = now - dt.timedelta(minutes=97 * i)
        rows.append(_row(when, source=("ha", "alertstream", "recording")[i % 3], type_=("motion", "door", "offline")[i % 3],
                         severity=("info", "alert")[i % 2], camera_id=(None, "cam-a", "cam-b")[i % 3]))
    boundary = now - dt.timedelta(days=90)
    for k in range(-5, 6):
        rows.append(_row(boundary + dt.timedelta(minutes=k), camera_id="cam-a"))
    with db.connection() as conn:
        _insert(conn, rows)
    with db.connection("read") as conn:
        assert _norm(events_router._facet_rows(conn, since)) == _norm(conn.execute(OLD_FACETS, (since,)).fetchall())

    # updates of facet columns (and of other columns), deletes (pruning) - the triggers keep the day counts in step
    with db.connection() as conn:
        conn.execute("UPDATE events SET type = 'person', camera_id = 'cam-c' WHERE rowid % 7 = 0")
        conn.execute("UPDATE events SET occurred_at = '2026-11-01T00:00:00Z' WHERE rowid % 11 = 0")
        conn.execute("UPDATE events SET count = count + 3, acked_at = '2026-11-09T00:00:00Z' WHERE rowid % 5 = 0")
        conn.execute("UPDATE events SET camera_id = NULL WHERE rowid % 13 = 0")
        conn.execute("DELETE FROM events WHERE occurred_at < ?", (iso_utc(now - dt.timedelta(days=60)),))
    with db.connection("read") as conn:
        assert _norm(events_router._facet_rows(conn, since)) == _norm(conn.execute(OLD_FACETS, (since,)).fetchall())
        # no zero rows left behind, every count matches the table per day
        assert conn.execute("SELECT COUNT(*) FROM events_facet_days WHERE n <= 0").fetchone()[0] == 0
        per_day = conn.execute("SELECT day, type, source, severity, camera_key, n FROM events_facet_days").fetchall()
        truth = conn.execute("SELECT substr(occurred_at, 1, 10), type, source, severity, COALESCE(camera_id, ''), COUNT(*) FROM events GROUP BY 1, 2, 3, 4, 5").fetchall()
        assert _norm(per_day) == _norm(truth)
        for days in (1, 7, 30, 365):
            s = iso_utc(now - dt.timedelta(days=days))
            assert _norm(events_router._facet_rows(conn, s)) == _norm(conn.execute(OLD_FACETS, (s,)).fetchall()), days


def test_migration_backfills_the_day_counts_and_is_idempotent(tmp_path):
    db = _db(tmp_path)
    now = dt.datetime(2026, 11, 9, 3, 50, tzinfo=UTC)
    with db.connection() as conn:
        _insert(conn, [_row(now - dt.timedelta(hours=7 * i), camera_id=("cam-a", None)[i % 2]) for i in range(400)])
        conn.execute("DELETE FROM events_facet_days")  # a database from before 0210: the table is filled from the events
    body = next(MIGRATIONS_DIR.glob("0210_*.sql")).read_text(encoding="utf-8")
    raw = sqlite3.connect(tmp_path / "g.db", isolation_level=None)
    try:
        raw.executescript(f"BEGIN;\n{body}\nCOMMIT;")
        raw.executescript(f"BEGIN;\n{body}\nCOMMIT;")  # twice: same result, triggers not duplicated
        got = raw.execute("SELECT day, type, source, severity, camera_key, n FROM events_facet_days").fetchall()
        truth = raw.execute("SELECT substr(occurred_at, 1, 10), type, source, severity, COALESCE(camera_id, ''), COUNT(*) FROM events GROUP BY 1, 2, 3, 4, 5").fetchall()
        assert _norm(got) == _norm(truth)
        trig = {r[0] for r in raw.execute("SELECT name FROM sqlite_master WHERE type = 'trigger' AND tbl_name = 'events' AND name LIKE 'trg_efd_%'")}
        assert trig == {"trg_efd_events_ins", "trg_efd_events_del", "trg_efd_events_upd"}
    finally:
        raw.close()
    assert db.migrate() == []


def test_facets_work_does_not_grow_with_older_days(tmp_path):
    """40x the rows on older days of the period: the facets' work stays within a small constant (the old GROUP BY walked
    every row - linear, ~490 ms at 677k rows in the soak)."""
    now = dt.datetime.now(UTC).replace(microsecond=0)
    since = iso_utc(now - dt.timedelta(days=90))
    small, large = _db(tmp_path / "s"), _db(tmp_path / "l")
    for db, n in ((small, 500), (large, 20_000)):
        with db.connection() as conn:
            # spread over days 1..80 of the period (not the partial first day), 8 cameras
            _insert(conn, [_row(now - dt.timedelta(days=1 + (i % 80), seconds=i), camera_id=f"cam-{i % 8}") for i in range(n)])
    with small.connection("read") as conn:
        out_s, steps_s = _steps(conn, lambda: events_router._facet_rows(conn, since))
    with large.connection("read") as conn:
        out_l, steps_l = _steps(conn, lambda: events_router._facet_rows(conn, since))
        old, steps_old = _steps(conn, lambda: conn.execute(OLD_FACETS, (since,)).fetchall())
    assert sum(r["n"] for r in out_s) == 500 and sum(r["n"] for r in out_l) == 20_000
    assert _norm(out_l) == _norm(old)
    assert steps_l <= max(2 * steps_s, steps_s + 50), (steps_s, steps_l)
    assert steps_old > 10 * steps_l, (steps_old, steps_l)  # the measurement itself is meaningful: the old query is linear


def test_facets_endpoint_answers_from_the_day_counts(client):
    db: Database = client.app.state.db
    now = dt.datetime.now(UTC).replace(microsecond=0)
    with db.connection() as conn:
        _insert(conn, [_row(now - dt.timedelta(hours=i), source="ha", type_="door") for i in range(30)]
                + [_row(now - dt.timedelta(days=100))])  # outside the 90 days
    body = client.get("/api/v1/events/facets").json()
    assert {"type": "door", "count": 30} in body["types"]
    assert {"source": "ha", "count": 30} in body["sources"]
    assert all(t["type"] != "motion" for t in body["types"])
    # the type filter's "never produced" note uses the same counts
    r = client.get("/api/v1/events?type=door").json()
    assert not r["filters"]["unsupported"]
    r = client.get("/api/v1/events?type=vehicle").json()
    assert r["filters"]["unsupported"] and r["filters"]["unsupported"][0]["value"] == "vehicle"


# ---------------------------------------------------------------- finding 2: write-lock holders

OLD_CAMERAS = """SELECT c.id,
  (SELECT MAX(COALESCE(e.ended_at, e.occurred_at)) FROM events e
    WHERE e.camera_id = c.id AND e.source = 'alertstream' AND e.type = 'offline' AND e.state = 'active' AND e.occurred_at >= ?) AS loss_at,
  (SELECT e.id FROM events e WHERE e.camera_id = c.id AND e.source = 'alertstream' AND e.type = 'offline' AND e.state = 'active' AND e.occurred_at >= ?
    ORDER BY e.occurred_at DESC LIMIT 1) AS loss_event
  FROM cameras c WHERE c.enabled = 1 AND c.recorder_id <> 'standalone' ORDER BY c.recorder_id, c.channel LIMIT 500"""


def _cameras(conn: sqlite3.Connection, n: int = 4) -> list[str]:
    ids = []
    now = iso_utc(dt.datetime.now(UTC))
    conn.execute("INSERT OR IGNORE INTO recorders(id, name, created_at) VALUES ('nvr-t', 'NVR', ?)", (now,))
    for ch in range(1, n + 1):
        cid = f"cam{ch:02d}" + uuid.uuid4().hex[:6]
        conn.execute("INSERT INTO cameras(id, recorder_id, channel, name_source, status, last_seen_at, enabled, created_at, updated_at) VALUES (?,'nvr-t',?,?,?,?,1,?,?)",
                     (cid, ch, f"Cam {ch}", "online", "2026-01-01T00:00:00Z", now, now))
        ids.append(cid)
    return ids


def _capture_camera_query(conn: sqlite3.Connection, now: dt.datetime) -> tuple[str, int]:
    """cameras_tick's own SQL (the first statement over cameras) and its work in units of 100 VM steps."""
    sql: list[str] = []
    conn.set_trace_callback(sql.append)
    try:
        _, steps = _steps(conn, lambda: notify_sources.cameras_tick(conn, now))
    finally:
        conn.set_trace_callback(None)
    q = next(s for s in sql if "FROM cameras c" in s)
    return q, steps


def test_camera_pass_walks_the_open_alert_index_with_unchanged_answers(tmp_path):
    db = _db(tmp_path)
    now = dt.datetime.now(UTC).replace(microsecond=0)
    cutoff = iso_utc(now - dt.timedelta(hours=24))
    with db.connection() as conn:
        cams = _cameras(conn)
        rows = []
        for i in range(3000):  # the soak's traffic: closed motion rows on every camera
            rows.append(_row(now - dt.timedelta(seconds=20 * i), source="alertstream", camera_id=cams[i % 4], state="inactive", ended=now - dt.timedelta(seconds=20 * i - 5)))
        # cam 0: an open video loss now and an older one; cam 1: a closed loss; cam 2: an open loss older than 24 h; cam 3: none
        rows.append(_row(now - dt.timedelta(minutes=5), source="alertstream", type_="offline", camera_id=cams[0], state="active", ended=now - dt.timedelta(minutes=1)))
        rows.append(_row(now - dt.timedelta(hours=3), source="alertstream", type_="offline", camera_id=cams[0], state="active"))
        rows.append(_row(now - dt.timedelta(minutes=9), source="alertstream", type_="offline", camera_id=cams[1], state="inactive"))
        rows.append(_row(now - dt.timedelta(hours=30), source="alertstream", type_="offline", camera_id=cams[2], state="active", ended=now - dt.timedelta(hours=1)))
        rows.append(_row(now - dt.timedelta(minutes=2), source="alertstream", type_="offline", camera_id=None, state="active"))  # device-level
        _insert(conn, rows)
    with db.connection() as conn:
        q, _ = _capture_camera_query(conn, now)  # the trace gives the statement with its values bound in
        assert cutoff in q
        plan = " | ".join(r[3] for r in conn.execute("EXPLAIN QUERY PLAN " + q).fetchall())
        assert "idx_events_alert_open" in plan and "idx_events_camera_time" not in plan and "SCAN e" not in plan, plan
        new = {r["id"]: (r["loss_at"], r["loss_event"]) for r in conn.execute(q).fetchall()}
        old = {r["id"]: (r["loss_at"], r["loss_event"]) for r in conn.execute(OLD_CAMERAS, (cutoff, cutoff)).fetchall()}
    assert new == old
    assert new[cams[0]][0] == iso_utc(now - dt.timedelta(minutes=1)) and new[cams[0]][1] is not None
    assert new[cams[1]] == (None, None) and new[cams[2]] == (None, None) and new[cams[3]] == (None, None)


def test_camera_pass_work_does_not_grow_with_the_cameras_traffic(tmp_path):
    """The soak's 8k events per camera and day made the pass linear under the write lock (~110 ms idle, 61.9 s starved)."""
    now = dt.datetime.now(UTC).replace(microsecond=0)
    out = []
    for name, n in (("s", 200), ("l", 12_000)):
        db = _db(tmp_path / name)
        with db.connection() as conn:
            cams = _cameras(conn)
            _insert(conn, [_row(now - dt.timedelta(seconds=5 * i), source="alertstream", camera_id=cams[i % 4], state="inactive") for i in range(n)])
        with db.connection() as conn:
            out.append(_capture_camera_query(conn, now)[1])
    steps_s, steps_l = out
    assert steps_l <= max(2 * steps_s, steps_s + 50), (steps_s, steps_l)


def test_health_never_takes_the_write_lock(client, monkeypatch):
    """GET /health is a read: it never opens a write transaction, and it answers while another writer holds the lock."""
    from smplwise import db as db_mod

    client.get("/api/v1/me")  # the bootstrap administrator exists first (a write of its own)
    labels: list[str] = []
    real = db_mod._begin_immediate

    def spy(conn, label, *a, **k):
        labels.append(label)
        return real(conn, label, *a, **k)

    monkeypatch.setattr(db_mod, "_begin_immediate", spy)
    assert client.get("/api/v1/health").status_code == 200  # also the first call's one-time warm-up, outside the timing below
    assert client.get("/api/v1/health", headers=as_user("viewer1")).status_code == 200
    assert not [lb for lb in labels if "/health" in lb], labels
    db: Database = client.app.state.db
    holding, release = threading.Event(), threading.Event()

    def hold() -> None:
        with db.connection(label="test.holder") as conn:
            conn.execute("INSERT INTO settings(key, value) VALUES ('soak2412.probe', '1') ON CONFLICT(key) DO UPDATE SET value = excluded.value")
            holding.set()
            release.wait(30)

    th = threading.Thread(target=hold, daemon=True)
    th.start()
    assert holding.wait(10)
    try:
        t = time.perf_counter()
        r = client.get("/api/v1/health")
        took = time.perf_counter() - t
    finally:
        release.set()
        th.join(10)
    assert r.status_code == 200 and r.json()["status"] == "ok"
    assert took < 5.0, f"/health waited {took:.1f} s behind another writer"
    assert r.json()["db"]["write_lock"]["gate"]["held"]  # the holder was still there while /health answered
