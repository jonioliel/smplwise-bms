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
