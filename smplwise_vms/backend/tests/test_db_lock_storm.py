"""SQLite write-path stress test (opt-in: SW_PERF=1) - the round-10 "database is locked" storm, pure database side.

    SW_PERF=1 [SW_DB_STORM_S=90] [SW_DB_STORM_FSYNC_MS=15] python -m pytest tests/test_db_lock_storm.py -s -p no:cacheprovider -o addopts=""

test_db_contention.py (SW_DB_LOAD=1) covers the device side: NVR / HA calls that used to run under the write lock.
This test has no device calls at all. It drives the product's own high-rate write paths at the same time, for
SW_DB_STORM_S seconds, against a temporary database:
- ha_state (2 threads, ~40 events/s): Home Assistant state_changed pushes (ha_sync.handle_state_event);
- alerts (~5/s): NVR alerts through events_ingest.LISTENER._handle;
- audit (~5/s): refusal audit rows from read-mode connections (write_aside);
- http_read (3 threads) and http_write (~3/s): real API requests through the ASGI app;
- probe (~4/s): a one-row write that measures how long an innocent writer waits.

Slow storage: SW_DB_STORM_FSYNC_MS (default 15) emulates the fsync of an SD card / eMMC - the storage of most Home
Assistant hosts - by holding every COMMIT of a synchronous=FULL connection that long before it runs (the lock is held
meanwhile, as it is during a real fsync). A synchronous=NORMAL commit in WAL mode does not fsync, so it is not delayed.
This is an emulation of the device, not a measurement of one; SW_DB_STORM_FSYNC_MS=0 measures this machine only.

Asserts: no "database is locked", no HTTP 500, every audit call wrote its row, and the write latency of every writer
stays bounded (p99 and max). The summary is printed (-s) and written to SW_DB_STORM_OUT when set."""
from __future__ import annotations

import datetime as dt
import json
import os
import random
import sqlite3
import statistics
import threading
import time
from dataclasses import dataclass, field
from typing import Any, Callable

import pytest
from fastapi.testclient import TestClient

from conftest import sw_perf_enabled, sw_time_factor
from smplwise import audit as audit_mod
from smplwise import db as db_mod
from smplwise.db import Database, set_setting
from smplwise.main import create_app
from smplwise.services import events_ingest, ha_sync

pytestmark = pytest.mark.skipif(not sw_perf_enabled(), reason="opt-in stress test (SW_PERF=1)")

DURATION_S = float(os.environ.get("SW_DB_STORM_S", "90"))
FSYNC_S = float(os.environ.get("SW_DB_STORM_FSYNC_MS", "15")) / 1000.0
TZ = "Asia/Jerusalem"
CAMERAS = 4
P99_BOUND_S = 1.0  # a write waits at most a second at the 99th percentile
MAX_BOUND_S = 5.0  # and never half the busy timeout


class SlowStorageConnection(sqlite3.Connection):
    """A COMMIT on a synchronous=FULL connection holds the lock FSYNC_S longer (see the module docstring)."""

    def execute(self, sql, *args):  # type: ignore[override]
        if FSYNC_S and isinstance(sql, str) and sql.strip().upper() == "COMMIT" and self.in_transaction:
            if super().execute("PRAGMA synchronous").fetchone()[0] >= 2:
                time.sleep(FSYNC_S)
        return super().execute(sql, *args)


@dataclass
class Stat:
    name: str
    writer: bool
    ops: int = 0
    locked: int = 0
    other: dict[str, int] = field(default_factory=dict)
    samples: list[tuple[float, float]] = field(default_factory=list)  # (start offset, latency)
    lock: threading.Lock = field(default_factory=threading.Lock)

    def add(self, start: float, secs: float, exc: BaseException | None = None) -> None:
        with self.lock:
            self.ops += 1
            self.samples.append((start, secs))
            if exc is not None:
                text = f"{type(exc).__name__}: {exc}"
                if "locked" in text.lower():
                    self.locked += 1
                else:
                    self.other[text[:80]] = self.other.get(text[:80], 0) + 1

    def summary(self) -> dict[str, Any]:
        lat = sorted(s for _, s in self.samples) or [0.0]
        pick = lambda q: round(lat[min(len(lat) - 1, int(q * (len(lat) - 1)))], 3)  # noqa: E731
        return {"actor": self.name, "writer": self.writer, "ops": self.ops, "locked": self.locked, "other_errors": sum(self.other.values()),
                "p50_s": round(statistics.median(lat), 3), "p95_s": pick(0.95), "p99_s": pick(0.99), "max_s": round(lat[-1], 3), "other_kinds": self.other}


def _state_event(eid: str, old: str, new: str, device_class: str | None) -> dict[str, Any]:
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    attrs = {"friendly_name": eid, **({"device_class": device_class} if device_class else {})}
    return {"entity_id": eid, "old_state": {"entity_id": eid, "state": old, "attributes": attrs, "last_changed": now, "last_updated": now},
            "new_state": {"entity_id": eid, "state": new, "attributes": attrs, "last_changed": now, "last_updated": now}}


def test_write_paths_under_sustained_concurrent_load(settings, monkeypatch):
    real_connect = sqlite3.connect
    monkeypatch.setattr(sqlite3, "connect", lambda *a, **kw: real_connect(*a, **{**kw, "factory": SlowStorageConnection}))
    app = create_app(settings)
    db: Database = app.state.db
    boot = TestClient(app)
    boot.get("/api/v1/me")  # the bootstrap administrator
    for ch in range(1, CAMERAS + 1):
        boot.post("/api/v1/cameras", json={"channel": ch, "alias": f"cam{ch}"})
    monkeypatch.setattr(events_ingest.LISTENER, "db", db)
    monkeypatch.setattr(events_ingest.LISTENER, "settings", settings)
    monkeypatch.setattr(events_ingest.LISTENER, "tz_getter", lambda: TZ)
    stats: dict[str, Stat] = {}
    stop = threading.Event()
    t0 = time.monotonic()
    deadline = t0 + DURATION_S

    def actor(name: str, pause: float, step: Callable[[int], None], writer: bool = True) -> threading.Thread:
        st = stats.setdefault(name, Stat(name, writer))

        def run() -> None:
            i = 0
            while not stop.is_set() and time.monotonic() < deadline:
                start = time.perf_counter()
                offset = time.monotonic() - t0
                try:
                    step(i)
                    st.add(offset, time.perf_counter() - start)
                except Exception as exc:  # noqa: BLE001 - counted, never fatal
                    st.add(offset, time.perf_counter() - start, exc)
                i += 1
                stop.wait(pause * (0.5 + random.random()))
        return threading.Thread(target=run, name=f"storm-{name}", daemon=True)

    def ha_state(k: int) -> Callable[[int], None]:
        def step(i: int) -> None:
            if i % 4 == 0:
                on = (i // 4) % 2 == 0
                ha_sync.handle_state_event(db, _state_event(f"binary_sensor.motion_{k}_{i % 3}", "off" if on else "on", "on" if on else "off", "motion"))
            else:
                ha_sync.handle_state_event(db, _state_event(f"sensor.power_{k}_{i % 7}", str(i - 1), str(i), "power"))
        return step

    def alert(i: int) -> None:
        events_ingest.LISTENER._handle(events_ingest.ParsedAlert(
            raw_type="VMD", state="active", channel=1 + i % CAMERAS, dyn_channel=None,
            device_time=dt.datetime.now(dt.timezone(dt.timedelta(hours=3))).replace(microsecond=0).isoformat(), description="", target="", active_post_count=1))

    def audit_step(i: int) -> None:
        with db.connection(mode="read") as conn:
            conn.execute("SELECT COUNT(*) FROM events").fetchone()
            audit_mod.audit(conn, actor=None, action="storm.audit", decision="denied", reason="load", details={"i": i})

    def probe(i: int) -> None:
        with db.connection() as conn:
            set_setting(conn, "storm.probe", str(i))

    clients: list[TestClient] = [boot]

    def http(method: str, paths: list[str], body: Callable[[int], dict[str, Any]] | None = None) -> Callable[[int], None]:
        c = TestClient(app, raise_server_exceptions=False)
        clients.append(c)

        def step(i: int) -> None:
            path = paths[i % len(paths)]
            r = c.request(method, path, json=body(i) if body else None)
            if r.status_code >= 500:
                raise RuntimeError(f"http {r.status_code} {path} {r.text[:60]}")
        return step

    reads = ["/api/v1/cameras", "/api/v1/events?limit=50", "/api/v1/settings", "/api/v1/me", "/api/v1/health"]
    threads = [
        actor("ha_state_a", 0.05, ha_state(0)), actor("ha_state_b", 0.05, ha_state(1)),
        actor("alerts", 0.2, alert), actor("audit", 0.2, audit_step), actor("probe", 0.25, probe),
        actor("http_write", 0.3, http("PATCH", ["/api/v1/settings"], lambda i: {"history.ha_secondary": "true" if i % 2 else "false"})),
        *[actor(f"http_read_{k}", 0.05, http("GET", reads[k:] + reads[:k]), writer=False) for k in range(3)],
    ]
    for t in threads:
        t.start()
    for t in threads:
        t.join(DURATION_S + 120)
    stop.set()
    elapsed = time.monotonic() - t0
    for c in clients:
        c.close()
    check = real_connect(db.path)
    try:
        audit_rows = check.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'storm.audit'").fetchone()[0]
    finally:
        check.close()  # Windows: an open handle keeps the temporary directory from being removed
    rows = [st.summary() for st in stats.values()]
    writes = sorted((s, st.name, off) for st in stats.values() if st.writer for off, s in st.samples)
    lat = [w[0] for w in writes] or [0.0]
    wal = db.path.with_name(db.path.name + "-wal")
    report = {
        "duration_s": round(elapsed, 1), "fsync_emulated_ms": FSYNC_S * 1000, "gate": hasattr(db_mod, "WriteGate"),
        "total_ops": sum(r["ops"] for r in rows), "total_locked": sum(r["locked"] for r in rows), "total_other_errors": sum(r["other_errors"] for r in rows),
        "writes": len(writes), "write_p50_s": round(statistics.median(lat), 3), "write_p95_s": round(lat[int(0.95 * (len(lat) - 1))], 3),
        "write_p99_s": round(lat[int(0.99 * (len(lat) - 1))], 3), "write_max_s": round(lat[-1], 3),
        "slowest_writes": [{"s": round(s, 3), "actor": a, "at_s": round(o, 1)} for s, a, o in writes[-6:]],
        "audit_rows_written": audit_rows, "audit_ok_ops": stats["audit"].ops - stats["audit"].locked - sum(stats["audit"].other.values()),
        "wal_bytes_at_end": wal.stat().st_size if wal.exists() else 0, "lock_stats": db_mod.lock_stats(), "actors": rows,
    }
    print("\n" + json.dumps(report, ensure_ascii=False, indent=1))
    out = os.environ.get("SW_DB_STORM_OUT")
    if out:
        with open(out, "w", encoding="utf-8") as fh:
            json.dump(report, fh, ensure_ascii=False, indent=1)
    factor = sw_time_factor()
    assert report["total_locked"] == 0, f"{report['total_locked']} 'database is locked' errors"
    assert report["total_other_errors"] == 0, [r["other_kinds"] for r in rows if r["other_errors"]]
    assert report["audit_rows_written"] == report["audit_ok_ops"], "every audit call that returned wrote its row"
    assert report["write_p99_s"] < P99_BOUND_S * factor, f"write p99 {report['write_p99_s']} s"
    assert report["write_max_s"] < MAX_BOUND_S * factor, f"write max {report['write_max_s']} s"
