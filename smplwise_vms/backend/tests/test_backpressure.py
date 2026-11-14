"""Backpressure (T068): the alert-ingest queue coalesces and drops with counters instead of growing, the event sockets
count what a slow client missed, and exports refuse (507) / pause / resume around a full data disk - with
shutil.disk_usage faked."""
from __future__ import annotations

import datetime as dt
import json
import sqlite3
import threading
import time
from collections import namedtuple
from dataclasses import replace
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from test_exports import fake_downloader, fake_pages, lab  # noqa: F401 - `lab` is a fixture

from smplwise.db import Database
from smplwise.main import create_app
from smplwise.services import events_ingest
from smplwise.services import exports as ex
from smplwise.services import nvr

Usage = namedtuple("Usage", "total used free")
MB = 1024 * 1024


def _alert(ch: int = 1, st: str = "active", et: str = "VMD", when: dt.datetime | None = None) -> events_ingest.ParsedAlert:
    when = when or dt.datetime.now(dt.timezone(dt.timedelta(hours=3))).replace(microsecond=0)
    return events_ingest.ParsedAlert(raw_type=et, state=st, channel=ch, dyn_channel=None, device_time=when.isoformat(), description="", target="", active_post_count=1)


def _invariant(q: events_ingest.IngestQueue) -> None:
    s = q.stats()
    assert s["accepted"] == s["processed"] + s["failed"] + s["coalesced"] + s["dropped"] + s["depth"], s


# ---------------------------------------------------------------- the ingest queue

def test_queue_coalesces_same_camera_kind_and_state_keeping_the_newest():
    q = events_ingest.IngestQueue(maxlen=10)
    t0 = dt.datetime(2026, 9, 29, 10, 0, 0, tzinfo=dt.timezone(dt.timedelta(hours=3)))
    assert q.put(_alert(1, when=t0)) == "queued"
    assert q.put(_alert(1, when=t0 + dt.timedelta(seconds=1))) == "coalesced"
    assert q.put(_alert(1, when=t0 + dt.timedelta(seconds=2))) == "coalesced"
    assert q.put(_alert(2, when=t0)) == "queued", "another camera is its own entry"
    assert q.put(_alert(1, st="inactive", when=t0 + dt.timedelta(seconds=3))) == "queued", "a state change is never folded into the active"
    assert q.put(_alert(1, when=t0 + dt.timedelta(seconds=4))) == "queued", "an active after the inactive keeps its order"
    first = q.get(0)
    assert first.merged == 2 and first.alert.device_time.endswith("10:00:02+03:00"), "the newest wins and carries the count"
    q.done(True)
    assert [q.get(0).alert.channel for _ in range(3)] == [2, 1, 1]
    for _ in range(3):
        q.done(True)
    assert q.get(0) is None
    _invariant(q)
    assert q.stats()["coalesced"] == 2 and q.stats()["dropped"] == 0


def test_coalescing_never_joins_two_episodes():
    """Motion at 10:00:00 and again at 10:01:40 (Hikvision sends no end): two entries, as store_alert keeps two rows;
    a chain within the window folds, but never spans more than DEDUP_WINDOW_S from its first alert."""
    q = events_ingest.IngestQueue(maxlen=10)
    t0 = dt.datetime(2026, 9, 29, 10, 0, 0, tzinfo=dt.timezone(dt.timedelta(hours=3)))
    assert q.put(_alert(1, when=t0)) == "queued"
    assert q.put(_alert(1, when=t0 + dt.timedelta(seconds=100))) == "queued", "a new episode"
    assert q.put(_alert(1, when=t0 + dt.timedelta(seconds=120))) == "coalesced", "same burst as the 100 s one"
    assert q.put(_alert(1, when=t0 + dt.timedelta(seconds=150))) == "queued", "within 30 s of the newest but 50 s after the first"
    assert [p.first.device_time[11:19] for p in (q.get(0), q.get(0), q.get(0))] == ["10:00:00", "10:01:40", "10:02:30"]


def test_coalesced_burst_stores_like_alert_by_alert(settings, monkeypatch):
    """The writer stores a folded entry as its first alert, then the newest carrying the ones in between: same rows,
    same count, same start and end as storing every alert one by one."""
    s = replace(settings, nvr_host="nvr.local", nvr_user="u", nvr_password="p")
    app = create_app(s)
    c = TestClient(app)
    c.post("/api/v1/cameras", json={"channel": 1, "alias": "c1"})
    db: Database = app.state.db
    q = events_ingest.IngestQueue(maxlen=16)
    monkeypatch.setattr(events_ingest, "QUEUE", q)
    listener = events_ingest.AlertStreamListener()
    listener.db, listener.settings, listener.tz_getter = db, s, lambda: "Asia/Jerusalem"
    base = dt.datetime.now(dt.timezone(dt.timedelta(hours=3))).replace(microsecond=0) - dt.timedelta(minutes=5)
    for sec in (0, 5, 10, 25, 100, 110):  # two episodes: 0-25 s (4 alerts) and 100-110 s (2 alerts)
        q.put(_alert(1, when=base + dt.timedelta(seconds=sec)))
    assert q.depth() == 2
    listener.stop.set()
    listener._drain(listener.generation)  # stopping: drains what is queued
    with db.connection(mode="read") as conn:
        rows = conn.execute("SELECT occurred_at, ended_at, count FROM events WHERE source = 'alertstream' ORDER BY occurred_at").fetchall()
    utc = lambda sec: (base + dt.timedelta(seconds=sec)).astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")  # noqa: E731
    assert [tuple(r) for r in rows] == [(utc(0), utc(25), 4), (utc(100), utc(110), 2)]
    _invariant(q)


def test_shutdown_drains_the_queue_then_counts_the_rest(settings, monkeypatch):
    s = replace(settings, nvr_host="nvr.local", nvr_user="u", nvr_password="p")
    app = create_app(s)
    c = TestClient(app)
    for ch in (1, 2, 3):
        c.post("/api/v1/cameras", json={"channel": ch, "alias": f"c{ch}"})
    db: Database = app.state.db
    q = events_ingest.IngestQueue(maxlen=16)
    monkeypatch.setattr(events_ingest, "QUEUE", q)
    listener = events_ingest.AlertStreamListener()
    listener.db, listener.settings, listener.tz_getter = db, s, lambda: "Asia/Jerusalem"
    for ch in (1, 2, 3):
        q.put(_alert(ch))
    listener.stop.set()
    listener._drain(listener.generation)
    assert q.stats()["processed"] == 3 and q.stats()["dropped_shutdown"] == 0, "within the deadline everything is stored"
    for ch in (1, 2, 3):
        q.put(_alert(ch, st="inactive"))
    monkeypatch.setattr(events_ingest, "DRAIN_S", 0.0)
    listener._drain(listener.generation)
    st = q.stats()
    assert st["dropped_shutdown"] == 3 and st["dropped"] == 3 and st["depth"] == 0, st
    _invariant(q)


def test_queue_is_bounded_and_drops_the_oldest_with_counters():
    q = events_ingest.IngestQueue(maxlen=5)
    for ch in range(1, 21):  # 20 distinct cameras: nothing to coalesce
        q.put(_alert(ch))
    s = q.stats()
    assert s["depth"] == 5 and s["high_water"] == 5 and s["dropped"] == 15
    assert [q.get(0).alert.channel for _ in range(5)] == [16, 17, 18, 19, 20], "the newest survive"
    for _ in range(5):
        q.done(True)
    _invariant(q)


def test_slow_database_never_grows_the_queue_and_repeats_reach_the_count(settings, monkeypatch):
    """The writer is stuck behind a write lock held elsewhere; the reader keeps queueing a busy NVR's alerts (8 cameras,
    motion bursts): the queue stays at one entry per camera, and when the database frees up the stored count of each
    burst equals what the device sent."""
    s = replace(settings, nvr_host="nvr.local", nvr_user="u", nvr_password="p")
    app = create_app(s)
    c = TestClient(app)
    for ch in range(1, 9):
        c.post("/api/v1/cameras", json={"channel": ch, "alias": f"c{ch}"})
    db: Database = app.state.db
    q = events_ingest.IngestQueue(maxlen=64)
    monkeypatch.setattr(events_ingest, "QUEUE", q)
    listener = events_ingest.AlertStreamListener()
    listener.db, listener.settings, listener.tz_getter = db, s, lambda: "Asia/Jerusalem"
    listener.stop.clear()
    blocker = sqlite3.connect(str(db.path), timeout=5, isolation_level=None)
    blocker.execute("BEGIN IMMEDIATE")  # the database is "slow": nobody else can write
    writer = threading.Thread(target=listener._drain, args=(listener.generation,), daemon=True)
    writer.start()
    try:
        base = dt.datetime.now(dt.timezone(dt.timedelta(hours=3))).replace(microsecond=0)
        sent = 0
        for i in range(400):
            listener.submit(_alert(1 + i % 8, when=base))
            sent += 1
        time.sleep(0.3)
        assert q.depth() <= 8 and q.stats()["high_water"] <= 9, q.stats()
    finally:
        blocker.execute("ROLLBACK")
        blocker.close()
    deadline = time.time() + 20
    while (q.depth() or q.stats()["processed"] + q.stats()["failed"] < q.stats()["accepted"] - q.stats()["coalesced"]) and time.time() < deadline:
        time.sleep(0.05)
    listener.stop.set()
    writer.join(5)
    _invariant(q)
    st = q.stats()
    assert st["dropped"] == 0 and st["failed"] == 0 and st["accepted"] == sent
    with db.connection(mode="read") as conn:
        total = conn.execute("SELECT SUM(count) FROM events WHERE source = 'alertstream'").fetchone()[0]
    assert total == sent, "every alert is in a row's count: coalesced repeats are not lost"


def test_store_alert_adds_repeats(settings):
    app = create_app(settings)
    c = TestClient(app)
    c.post("/api/v1/cameras", json={"channel": 1, "alias": "a"})
    db: Database = app.state.db
    now = dt.datetime.now(dt.timezone.utc)
    with db.connection() as conn:
        lookup = lambda ch: conn.execute("SELECT * FROM cameras WHERE channel = ?", (ch,)).fetchone()  # noqa: E731
        e1 = events_ingest.store_alert(conn, _alert(1, when=now.astimezone(dt.timezone(dt.timedelta(hours=3)))), "Asia/Jerusalem", lookup, now, repeats=3)
        e2 = events_ingest.store_alert(conn, _alert(1, when=now.astimezone(dt.timezone(dt.timedelta(hours=3)))), "Asia/Jerusalem", lookup, now, repeats=2)
    assert e1["count"] == 4 and e1["details"]["coalesced"] == 3
    assert e2["id"] == e1["id"] and e2["count"] == 7


def test_slow_event_socket_drops_are_counted():
    q = events_ingest.subscribe()
    try:
        before = events_ingest.STATE.ws_drops
        for i in range(q.maxsize + 7):
            events_ingest.publish({"id": str(i)})
        assert events_ingest.STATE.ws_drops - before == 7 and q.qsize() == q.maxsize
    finally:
        events_ingest.unsubscribe(q)


# ---------------------------------------------------------------- exports and the data disk

class FakeDisk:
    """shutil.disk_usage for the data dir: `free` MB, minus whatever the export job folders hold when `track` is on
    (the downloads really fill this pretend disk)."""

    def __init__(self, settings, free_mb: int, track: bool = False) -> None:
        self.settings, self.free_mb, self.track = settings, free_mb, track

    def __call__(self, _path) -> Usage:
        used = sum(p.stat().st_size for p in (self.settings.data_dir / "exports").rglob("*") if p.is_file()) if self.track else 0
        free = max(0, self.free_mb * MB - used)
        return Usage(100_000 * MB, 100_000 * MB - free, free)


RANGE = {"from_at": "2026-09-14T07:00:00Z", "to_at": "2026-09-14T07:10:00Z"}


def test_new_export_refused_with_507_below_the_minimum(lab, monkeypatch):  # noqa: F811
    c, s, cam = lab
    c.patch("/api/v1/settings", json={"storage.min_free_mb": 500})
    monkeypatch.setattr(ex.shutil, "disk_usage", FakeDisk(s, 300))
    before = ex.stats()["refused_disk"]
    r = c.post("/api/v1/exports", json={"camera_id": cam["id"], **RANGE})
    assert r.status_code == 507 and r.json()["code"] == "insufficient_storage" and "300 MB" in r.json()["user_message"] and "500 MB" in r.json()["user_message"]
    assert r.json()["retryable"] is True and ex.stats()["refused_disk"] == before + 1
    # enough room now, but the export itself would cross the line
    monkeypatch.setattr(nvr, "search_recordings", fake_pages([("2026-09-14T10:00:00Z", "2026-09-14T10:02:00Z", "MOTION", "big", 300 * MB)]))
    c.patch("/api/v1/settings", json={"exports.max_mb": 1000})
    monkeypatch.setattr(ex.shutil, "disk_usage", FakeDisk(s, 700))
    r = c.post("/api/v1/exports", json={"camera_id": cam["id"], **RANGE})
    assert r.status_code == 507 and "300 MB" in r.json()["user_message"]
    monkeypatch.setattr(ex.shutil, "disk_usage", FakeDisk(s, 5000))
    assert c.post("/api/v1/exports", json={"camera_id": cam["id"], **RANGE}).status_code == 201
    local = c.get("/api/v1/storage/local").json()
    assert local["data_disk"]["min_free_mb"] == 500 and local["data_disk"]["low"] is False and local["exports"]["counters"]["refused_disk"] >= 2


def test_export_queue_is_bounded(lab, monkeypatch):  # noqa: F811
    c, s, cam = lab
    monkeypatch.setattr(ex, "MAX_QUEUED_TOTAL", 2)
    assert c.post("/api/v1/exports", json={"camera_id": cam["id"], **RANGE}).status_code == 201
    assert c.post("/api/v1/exports", json={"camera_id": cam["id"], **RANGE}).status_code == 201
    r = c.post("/api/v1/exports", json={"camera_id": cam["id"], **RANGE})
    assert r.status_code == 429 and r.json()["code"] == "export_queue_full" and r.json()["retryable"] is True


def _chunked_downloader(calls: list[str], chunk: int, chunks: int, on_start=None):
    """Writes `chunks` x `chunk` bytes, calling progress after each - like nvr.download_file - and aborts like it."""

    def dl(_settings, playback_uri, dest, progress=None):
        from smplwise.errors import ApiError

        name = playback_uri.split("name=")[1].split("&")[0]
        calls.append(name)
        if on_start:
            on_start(name)
        written = 0
        with open(dest, "wb") as f:
            for _ in range(chunks):
                f.write(b"\x00" * chunk)
                f.flush()
                written += chunk
                if progress and progress(written) is False:
                    raise ApiError(499, "cancelled", "ההורדה בוטלה.")
    return dl


def test_running_export_pauses_when_the_disk_fills_and_resumes(lab, monkeypatch):  # noqa: F811
    c, s, cam = lab
    monkeypatch.setattr(ex, "ffmpeg_path", lambda: None)
    monkeypatch.setattr(ex, "DISK_CHECK_EVERY_S", 0.0)
    monkeypatch.setattr(ex, "RESUME_MARGIN_MB", 1)
    monkeypatch.setattr(ex, "PAUSE_BACKOFF_S", (0,))  # the back-off has its own test
    c.patch("/api/v1/settings", json={"storage.min_free_mb": 100})
    files = [("2026-09-14T10:00:00Z", "2026-09-14T10:02:00Z", "MOTION", "f1", 2 * MB), ("2026-09-14T10:05:00Z", "2026-09-14T10:07:00Z", "MOTION", "f2", 2 * MB)]
    monkeypatch.setattr(nvr, "search_recordings", fake_pages(files))
    disk = FakeDisk(s, 110, track=True)  # 10 MB above the minimum: room for the 4 MB export when it is created
    monkeypatch.setattr(ex.shutil, "disk_usage", disk)
    calls: list[str] = []

    def something_else_fills_the_disk(name: str) -> None:
        if name == "f2" and calls.count("f2") == 1:
            disk.free_mb = 103  # recordings, thumbnails, a backup...: f1 (2 MB) is on disk, f2 crosses the line half-way

    ex.WORKER.downloader = _chunked_downloader(calls, 256 * 1024, 8, on_start=something_else_fills_the_disk)
    job = c.post("/api/v1/exports", json={"camera_id": cam["id"], **RANGE}).json()
    paused_before = ex.stats()["paused_disk_full"]
    ex.WORKER.run_pending()
    j = c.get(f"/api/v1/exports/{job['id']}").json()
    assert j["state"] == "paused_disk_full" and "הושהה" in j["error"], j
    assert [f["state"] for f in j["files"]] == ["downloaded", "pending"] and ex.stats()["paused_disk_full"] == paused_before + 1
    assert not (ex.job_dir(s, job["id"]) / "001.ps").exists(), "the partial second file is not kept"
    local = c.get("/api/v1/storage/local").json()
    assert local["exports"]["paused_disk_full"] == 1
    # still no room: the worker leaves it paused; a manual resume says why it cannot
    ex.WORKER.run_pending()
    assert c.get(f"/api/v1/exports/{job['id']}").json()["state"] == "paused_disk_full"
    disk.free_mb = 99
    r = c.post("/api/v1/storage/exports/resume")
    assert r.status_code == 507 and r.json()["code"] == "insufficient_storage"
    # room again (someone deleted old exports): the worker resumes it on its own and continues with the second file only
    disk.free_mb = 200
    ex.WORKER.run_pending()
    j = c.get(f"/api/v1/exports/{job['id']}").json()
    assert j["state"] == "done" and calls == ["f1", "f2", "f2"], (j["state"], calls)
    assert ex.stats()["resumed"] >= 1


def test_manual_resume_and_cancel_of_a_paused_job(lab, monkeypatch):  # noqa: F811
    c, s, cam = lab
    job = c.post("/api/v1/exports", json={"camera_id": cam["id"], **RANGE}).json()
    with ex.WORKER.db.connection() as conn:
        conn.execute("UPDATE export_jobs SET state = 'paused_disk_full' WHERE id = ?", (job["id"],))
    monkeypatch.setattr(ex.shutil, "disk_usage", FakeDisk(s, 5000))
    r = c.post("/api/v1/storage/exports/resume")
    assert r.status_code == 200 and r.json()["resumed"] == 1
    assert c.get(f"/api/v1/exports/{job['id']}").json()["state"] == "queued"
    with ex.WORKER.db.connection() as conn:
        conn.execute("UPDATE export_jobs SET state = 'paused_disk_full' WHERE id = ?", (job["id"],))
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'export.resume'").fetchone()[0] == 1
    assert c.post(f"/api/v1/exports/{job['id']}/cancel").json()["state"] == "cancelled", "a paused job can be cancelled"


def test_unknown_size_job_does_not_loop_download_pause_resume(lab, monkeypatch):  # noqa: F811
    """The NVR lists the file without a size: the creation guard estimates it (never 0), and after a mid-file pause
    the job waits both for its back-off (15 s, 1 min, 5 min) and for room for at least the bytes it reached -
    instead of downloading to the same point, pausing and resuming every 15 s against the NVR."""
    c, s, cam = lab
    monkeypatch.setattr(ex, "ffmpeg_path", lambda: None)
    monkeypatch.setattr(ex, "DISK_CHECK_EVERY_S", 0.0)
    monkeypatch.setattr(ex, "RESUME_MARGIN_MB", 1)
    monkeypatch.setattr(ex, "UNKNOWN_FILE_BYTES", 1 * MB)
    c.patch("/api/v1/settings", json={"storage.min_free_mb": 100})
    monkeypatch.setattr(nvr, "search_recordings", fake_pages([("2026-09-14T10:00:00Z", "2026-09-14T10:02:00Z", "MOTION", "nosize", "")]))
    disk = FakeDisk(s, 102, track=True)  # room for the 1 MB guess, not for the real 4 MB file
    monkeypatch.setattr(ex.shutil, "disk_usage", disk)
    clock = {"now": dt.datetime(2026, 9, 29, 10, 0, 0, tzinfo=dt.timezone.utc)}
    monkeypatch.setattr(ex, "_now", lambda: clock["now"])
    calls: list[str] = []
    ex.WORKER.downloader = _chunked_downloader(calls, 256 * 1024, 16)  # 4 MB
    job = c.post("/api/v1/exports", json={"camera_id": cam["id"], **RANGE}).json()
    assert job["files"][0]["size"] is None
    ex.WORKER.run_pending()
    j = c.get(f"/api/v1/exports/{job['id']}").json()
    assert j["state"] == "paused_disk_full" and j["pauses"] == 1 and j["need_bytes"] >= 2 * MB, (j["state"], j.get("need_bytes"))
    # the partial file is gone, so free space is back at 102 MB: the old rule (remaining = 0 MB) resumed at once
    for step in (5, 30, 60):
        clock["now"] += dt.timedelta(seconds=step)
        ex.WORKER.run_pending()
        assert c.get(f"/api/v1/exports/{job['id']}").json()["state"] == "paused_disk_full"
    assert calls == ["nosize"], "no new download while the room it needs is not there"
    disk.free_mb = 110  # room for what it reached (+ margin): it resumes and completes
    ex.WORKER.run_pending()
    j = c.get(f"/api/v1/exports/{job['id']}").json()
    assert j["state"] == "done" and calls == ["nosize", "nosize"] and j["pauses"] == 0


def test_pause_back_off_grows(lab, monkeypatch):  # noqa: F811
    c, s, cam = lab
    monkeypatch.setattr(ex, "DISK_CHECK_EVERY_S", 0.0)
    c.patch("/api/v1/settings", json={"storage.min_free_mb": 100})
    monkeypatch.setattr(nvr, "search_recordings", fake_pages([("2026-09-14T10:00:00Z", "2026-09-14T10:02:00Z", "MOTION", "f1", 1 * MB)]))
    disk = FakeDisk(s, 5000)
    monkeypatch.setattr(ex.shutil, "disk_usage", disk)
    t0 = dt.datetime(2026, 9, 29, 10, 0, 0, tzinfo=dt.timezone.utc)
    monkeypatch.setattr(ex, "_now", lambda: t0)
    job = c.post("/api/v1/exports", json={"camera_id": cam["id"], **RANGE}).json()
    disk.free_mb = 50  # below the minimum before the first byte: pause at once
    waits = []
    for _ in range(4):
        with ex.WORKER.db.connection() as conn:
            conn.execute("UPDATE export_jobs SET state = 'queued' WHERE id = ?", (job["id"],))
        ex.WORKER.run_pending()
        j = c.get(f"/api/v1/exports/{job['id']}").json()
        waits.append(int((dt.datetime.fromisoformat(j["resume_after"].replace("Z", "+00:00")) - t0).total_seconds()))
    assert waits == [15, 60, 300, 300]


def test_a_crashing_job_is_marked_failed_not_left_running(lab, monkeypatch):  # noqa: F811
    c, s, cam = lab
    job = c.post("/api/v1/exports", json={"camera_id": cam["id"], **RANGE}).json()

    def boom(_job_id: str) -> None:
        raise RuntimeError("database is locked")  # e.g. a progress write that stayed busy past its retries

    monkeypatch.setattr(ex.WORKER, "_run", boom)
    assert ex.WORKER.run_pending() == 1
    j = c.get(f"/api/v1/exports/{job['id']}").json()
    assert j["state"] == "failed" and "RuntimeError" in j["error"]


def test_health_shows_the_queues(settings):
    c = TestClient(create_app(settings))
    h = c.get("/api/v1/health").json()
    bp = h["backpressure"]
    assert {"depth", "max", "accepted", "coalesced", "dropped"} <= set(bp["ingest_queue"])
    assert {"refused_disk", "refused_queue_full", "paused_disk_full", "resumed"} <= set(bp["exports"]["counters"])
    assert bp["data_disk"]["min_free_mb"] == 1024 and "queue" in h["events"]["ingest"] and "ws_drops" in h["events"]["ingest"]
