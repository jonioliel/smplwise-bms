"""Opt-in measurement of the events-window cache (T068) under ingest load, in the pattern of test_db_contention.py.
Skipped unless SW_EVENTS_PERF=1.

    SW_EVENTS_PERF=1 [SW_EVENTS_PERF_S=60] [SW_EVENTS_PERF_OUT=report.json] python -m pytest tests/test_events_cache_perf.py -s -p no:cacheprovider

One temporary database seeded with a busy day (SW_EVENTS_PERF_SEED events over the last 24 h on 8 cameras), then three
phases of SW_EVENTS_PERF_S seconds each with the same load:
- "before": the pre-T068 path - no window cache, thumbnail state from two stat() calls per listed event;
- "index": the thumbnail folder index only (no window cache);
- "after": the folder index and the window cache (the shipped configuration).
The load:
- ingest: the NVR alert stream through events_ingest.LISTENER._handle, 8 channels, ~SW_EVENTS_PERF_RATE alerts/s (mostly
  repeats of open bursts, every fifth one a new row) - the 0.1.58 "8 channels notify the surveillance centre" picture;
- 6 readers of the 24 h events list (limit 500, the event centre's first screen) and 2 readers of the facets, through
  the real ASGI app, each waiting SW_EVENTS_PERF_PAUSE seconds (default 0.2) between its requests - so a faster phase
  does not simply buy itself more concurrent requests (0 = closed loop, as fast as it can).
Prints p50 / p95 / max per endpoint and phase, and the cache counters."""
from __future__ import annotations

import datetime as dt
import json
import os
import statistics
import threading
import time
import uuid
from dataclasses import replace
from typing import Any

import pytest
from fastapi.testclient import TestClient

from smplwise.db import Database, now_iso
from smplwise.main import create_app
from smplwise.services import events_cache, events_ingest, thumbnails
from smplwise.services.timeutil import iso_utc

pytestmark = pytest.mark.skipif(os.environ.get("SW_EVENTS_PERF") != "1", reason="opt-in measurement (SW_EVENTS_PERF=1)")

PHASE_S = float(os.environ.get("SW_EVENTS_PERF_S", "60"))
SEED = int(os.environ.get("SW_EVENTS_PERF_SEED", "3000"))
RATE = float(os.environ.get("SW_EVENTS_PERF_RATE", "8"))
PAUSE = float(os.environ.get("SW_EVENTS_PERF_PAUSE", "0.2"))
CAMERAS = 8
TZ = "Asia/Jerusalem"


def _pct(values: list[float]) -> dict[str, Any]:
    v = sorted(values) or [0.0]
    return {"n": len(values), "p50_ms": round(statistics.median(v) * 1000, 1), "p95_ms": round(v[int(0.95 * (len(v) - 1))] * 1000, 1), "max_ms": round(v[-1] * 1000, 1)}


def _seed(db: Database, cams: list[dict[str, Any]]) -> None:
    now = dt.datetime.now(dt.timezone.utc)
    rows = []
    for i in range(SEED):
        cam = cams[i % CAMERAS]
        at = now - dt.timedelta(seconds=(i * 86000) // SEED + 30)
        typ = ("motion", "line", "field", "person")[i % 4]
        details = json.dumps({"description": f"{typ} alarm", "time_precision": "device_offset", "active_post_count": 1})
        rows.append((uuid.uuid4().hex[:12], "alertstream", "VMD", typ, cam["id"], cam["channel"], iso_utc(at), iso_utc(at + dt.timedelta(seconds=20)), now_iso(), "inactive", 1 + i % 5,
                     "info", "measured", details, f"seed:{i}", now_iso()))
    with db.connection() as conn:
        conn.executemany("INSERT INTO events(id, source, raw_type, type, camera_id, channel, occurred_at, ended_at, received_at, state, count, severity, confidence, details_json, dedup_key, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", rows)


def test_events_window_cache_under_ingest(settings, monkeypatch):
    s = replace(settings, nvr_host="nvr.local", nvr_user="u", nvr_password="p")
    app = create_app(s)
    db: Database = app.state.db
    boot = TestClient(app)
    cams = [boot.post("/api/v1/cameras", json={"channel": ch, "alias": f"cam{ch}"}).json() for ch in range(1, CAMERAS + 1)]
    _seed(db, cams)
    monkeypatch.setattr(events_ingest.LISTENER, "db", db)
    monkeypatch.setattr(events_ingest.LISTENER, "settings", s)
    monkeypatch.setattr(events_ingest.LISTENER, "tz_getter", lambda: TZ)
    monkeypatch.setattr(thumbnails.WORKER, "request", lambda *_a, **_k: None)  # no ffmpeg grabs: this measures the list itself

    indexed = thumbnails.statuses_for

    def per_row(settings_, ids):  # the pre-T068 behaviour: status_for (two stats) for every listed event
        return {i: thumbnails.status_for(settings_, i) for i in ids}

    def phase(name: str, enabled: bool, index: bool) -> dict[str, Any]:
        events_cache.CACHE.clear()
        events_cache.CACHE.reset_stats()
        monkeypatch.setattr(events_cache.CACHE, "enabled", enabled)
        monkeypatch.setattr(thumbnails, "statuses_for", indexed if index else per_row)
        stop = threading.Event()
        lat: dict[str, list[float]] = {"events_24h": [], "facets": []}
        errors: list[str] = []
        ingested = [0]
        lock = threading.Lock()
        with db.connection(mode="read") as conn:
            rows_at_start = conn.execute("SELECT COUNT(*) FROM events").fetchone()[0]

        def ingest() -> None:
            i = 0
            while not stop.is_set():
                ch = 1 + i % CAMERAS
                new_row = i % 5 == 0
                a = events_ingest.ParsedAlert(raw_type="linedetection" if new_row and i % 2 else "VMD", state="active", channel=ch, dyn_channel=None,
                                              device_time=dt.datetime.now(dt.timezone(dt.timedelta(hours=3))).replace(microsecond=0).isoformat(),
                                              description="", target="", active_post_count=1)
                try:
                    events_ingest.LISTENER._handle(a)
                    ingested[0] += 1
                except Exception as exc:  # noqa: BLE001
                    with lock:
                        errors.append(f"ingest {type(exc).__name__}: {exc}")
                i += 1
                stop.wait(1.0 / RATE)

        def reader(name: str, path: str) -> None:
            c = TestClient(app, raise_server_exceptions=False)
            try:
                while not stop.is_set():
                    t0 = time.perf_counter()
                    r = c.get(path)
                    dt_s = time.perf_counter() - t0
                    with lock:
                        if r.status_code != 200:
                            errors.append(f"{name} http {r.status_code}")
                        else:
                            lat[name].append(dt_s)
                    if PAUSE:
                        stop.wait(PAUSE)
            finally:
                c.close()

        threads = [threading.Thread(target=ingest, daemon=True)]
        threads += [threading.Thread(target=reader, args=("events_24h", "/api/v1/events?limit=500"), daemon=True) for _ in range(6)]
        threads += [threading.Thread(target=reader, args=("facets", "/api/v1/events/facets"), daemon=True) for _ in range(2)]
        for t in threads:
            t.start()
        time.sleep(PHASE_S)
        stop.set()
        for t in threads:
            t.join(30)
        return {"phase": name, "cache": "on" if enabled else "off", "thumbnail_index": index, "rows_at_start": rows_at_start, "alerts_ingested": ingested[0], "errors": errors[:10], "error_count": len(errors),
                "events_24h": _pct(lat["events_24h"]), "facets": _pct(lat["facets"]), "cache_stats": events_cache.CACHE.stats()}

    before = phase("before", False, False)
    index_only = phase("index", False, True)
    after = phase("after", True, True)
    boot.close()
    report = {"phase_s": PHASE_S, "seed_events": SEED, "alert_rate_per_s": RATE, "reader_pause_s": PAUSE, "readers": {"events_24h": 6, "facets": 2}, "before": before, "index": index_only, "after": after}
    print("\n" + json.dumps(report, ensure_ascii=False, indent=1))
    out = os.environ.get("SW_EVENTS_PERF_OUT")
    if out:
        with open(out, "w", encoding="utf-8") as fh:
            json.dump(report, fh, ensure_ascii=False, indent=1)
    assert before["error_count"] == 0 and index_only["error_count"] == 0 and after["error_count"] == 0, (before["errors"], index_only["errors"], after["errors"])
    assert after["cache_stats"]["hits"] > 0
