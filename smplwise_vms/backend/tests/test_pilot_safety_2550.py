"""PILOT-ROLLBACK-2550 (T035): the pilot safety cases the outage run (test_outage_run_t035.py) and the soak edges
(test_soak_edges_2450.py / test_soak_edges2_2450.py) did not reach. Fakes and temporary folders only - no lab, no device.

Full data disk AT COMMIT. The earlier fakes refuse a write STATEMENT; on a real full volume SQLite usually fails later, at COMMIT,
when the WAL is written (the runner's disk-full of 2026-11-25 showed "database or disk is full" surfacing as 500). The request's
commit runs in main.CommitBeforeSend as the answer starts - outside the exception handlers - so the operator got a bare
`internal_error` 500 for a write that was not stored, and the read of the top-bar summary failed too. Expected: the same 507
`storage_full` envelope as a refused statement, nothing stored, never a success, and the refused change never committed later.

Wall-clock jumps (NTP correcting a host that booted with a wrong clock). Expected: an outage that is real stays visible, its
coverage gap keeps its measured length, a short blip is not turned into an hour-long gap, and a reachable video service is still
re-checked on schedule - never a silent "ok".

Each test prints one `PILOT_2550 {json}` line (`pytest -rA -s`)."""
from __future__ import annotations

import json
import re
import sqlite3
import time
import types
from dataclasses import replace
from typing import Any

import pytest
from fastapi.testclient import TestClient

from smplwise import db as dbmod
from smplwise.db import Database
from smplwise.main import create_app
from smplwise.recorder_scope import PRIMARY
from smplwise.services import events_ingest, health_report, media_reach

ENVELOPE = {"code", "user_message", "retryable", "correlation_id", "details"}


def record(case: str, **observed: Any) -> None:
    print("PILOT_2550 " + json.dumps({"case": case, **observed}, ensure_ascii=False, sort_keys=True, default=str))


# ---------------------------------------------------------------- a disk that fills up at COMMIT

DISK = {"full": False, "refused_commits": 0}
_BEGIN = re.compile(r"^\s*BEGIN\b", re.IGNORECASE)
_COMMIT = re.compile(r"^\s*(COMMIT|END)\b", re.IGNORECASE)


class _FullAtCommit(sqlite3.Connection):
    """While DISK["full"]: a COMMIT of a transaction that changed something fails as SQLite fails when the WAL cannot grow
    (SQLITE_FULL); statements, reads and empty commits work - what a full volume does to a WAL database."""

    def execute(self, sql: str, *a: Any, **k: Any) -> sqlite3.Cursor:  # type: ignore[override]
        if _BEGIN.match(sql or ""):
            cur = super().execute(sql, *a, **k)
            self._changes_at_begin = self.total_changes
            return cur
        if DISK["full"] and _COMMIT.match(sql or "") and self.in_transaction and self.total_changes != getattr(self, "_changes_at_begin", self.total_changes):
            DISK["refused_commits"] += 1
            exc = sqlite3.OperationalError("database or disk is full")
            exc.sqlite_errorcode = dbmod.SQLITE_FULL  # type: ignore[attr-defined]
            raise exc
        return super().execute(sql, *a, **k)


class _Sqlite3Shim:
    def __getattr__(self, name: str) -> Any:
        return getattr(sqlite3, name)

    @staticmethod
    def connect(*a: Any, **k: Any) -> sqlite3.Connection:
        return sqlite3.connect(*a, factory=_FullAtCommit, **k)


@pytest.fixture()
def full_at_commit(monkeypatch):
    monkeypatch.setattr(dbmod, "sqlite3", _Sqlite3Shim())
    DISK.update(full=False, refused_commits=0)
    yield DISK
    DISK.update(full=False, refused_commits=0)


def _site_names(c: TestClient) -> list[str]:
    r = c.get("/api/v1/sites")
    assert r.status_code == 200, r.text
    body = r.json()
    return [s.get("name") for s in body["sites"]]


def test_p1_a_commit_refused_by_a_full_disk_answers_507_and_stores_nothing(settings, monkeypatch, full_at_commit):
    monkeypatch.setattr(dbmod, "STORAGE_REFUSAL_WINDOW_S", 4.0)
    app = create_app(settings)
    c = TestClient(app, raise_server_exceptions=False)
    assert c.get("/api/v1/sites").status_code == 200  # the bootstrap grant is written while there is room
    app.state.db.invalidate_pool()
    assert c.get("/api/v1/health/summary").status_code == 200  # warm (its first call imports a lot: seconds on a slow box)

    full_at_commit["full"] = True
    refused = c.post("/api/v1/sites", json={"name": "refused while full"})
    assert refused.status_code == 507, f"a refused COMMIT must not answer {refused.status_code}: {refused.text}"
    body = refused.json()
    assert set(body) == ENVELOPE and body["code"] == "storage_full" and body["retryable"] is False and body["details"] == {"storage": "full"}
    pill = c.get("/api/v1/health/summary")
    assert refused.headers.get("x-correlation-id") == body["correlation_id"] != ""
    assert full_at_commit["refused_commits"] >= 1, "the fake refused the commit (not a statement)"
    assert "refused while full" not in _site_names(c), "reads still work, and the refused change is not there"
    assert pill.status_code == 200, f"the operator can still read the state: {pill.text}"
    storage = {i["id"]: i for i in pill.json()["items"]}.get("storage")
    assert storage is not None and storage["status"] == "error", pill.json()

    full_at_commit["full"] = False  # space freed
    assert "refused while full" not in _site_names(c), "the refused change was never committed afterwards"
    assert c.post("/api/v1/sites", json={"name": "after space was freed"}).status_code == 201
    assert "after space was freed" in _site_names(c) and "refused while full" not in _site_names(c)
    deadline = time.monotonic() + 10
    while any(i["id"] == "storage" for i in c.get("/api/v1/health/summary").json()["items"]) and time.monotonic() < deadline:
        time.sleep(0.2)
    assert not any(i["id"] == "storage" for i in c.get("/api/v1/health/summary").json()["items"]), "the warning clears by itself"
    record("P1 commit refused by a full disk", answer=[refused.status_code, body["code"], body["user_message"]], summary_item=storage,
           refused_commits=full_at_commit["refused_commits"], stored=False, recovered=True)


def test_p2_a_refused_commit_is_rolled_back_at_once_and_never_committed_later(settings, full_at_commit):
    """db.release (the commit as the answer starts): when the COMMIT is refused the transaction is rolled back there and then. Before
    the fix it stayed open, and the request's closing connection() committed it - also when space had been freed in between, after
    the client was told the change failed."""
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    db = Database(settings.data_dir / "p2.db")
    db.migrate()
    with db.connection() as conn:
        conn.execute("CREATE TABLE p2(v TEXT)")
    with db.connection() as conn:
        conn.execute("INSERT INTO p2(v) VALUES ('kept')")
        full_at_commit["full"] = True
        with pytest.raises(sqlite3.OperationalError) as info:
            dbmod.release(conn)
        assert dbmod.is_storage_full(info.value)
        assert not conn.in_transaction, "rolled back at once"
        full_at_commit["full"] = False  # space freed before the request's connection closes
    with db.connection(mode="read") as conn:
        rows = [r[0] for r in conn.execute("SELECT v FROM p2").fetchall()]
    assert rows == [], f"a change reported as failed was committed later: {rows}"
    started = time.monotonic()
    with db.connection() as conn:  # the write gate was handed on
        conn.execute("INSERT INTO p2(v) VALUES ('next')")
    assert time.monotonic() - started < 2.0
    record("P2 refused commit rolled back", committed_later=False, gate_free=True)


# ---------------------------------------------------------------- wall-clock jumps

def _shift_wall_clock(monkeypatch, *modules: Any, by_s: float) -> None:
    """The modules' `time.time()` moves by `by_s` (an NTP step); `time.monotonic()` is untouched, as on a real host."""
    shifted = types.SimpleNamespace(**{k: getattr(time, k) for k in dir(time) if not k.startswith("__")})
    real = time.time
    shifted.time = lambda: real() + by_s
    for m in modules:
        monkeypatch.setattr(m, "time", shifted)


@pytest.fixture()
def ingest_state():
    st = events_ingest.STATE
    saved = (st.connected, st.disconnected_since, st.last_heartbeat_at)
    yield st
    st.connected, st.last_heartbeat_at = saved[0], saved[2]
    st.disconnected_since = saved[1]


def test_c1_a_down_nvr_stays_an_error_when_the_wall_clock_moves_back(settings, monkeypatch, ingest_state):
    app = create_app(replace(settings, nvr_host="nvr.example", nvr_user="viewer", nvr_password="pw"))
    c = TestClient(app)
    ingest_state.connected = False
    ingest_state.last_heartbeat_at = "2026-11-25T08:00:00Z"
    ingest_state.disconnected_since = time.time() - 120  # down for two minutes
    assert {i["id"]: i["status"] for i in c.get("/api/v1/health/summary").json()["items"]}.get("nvr") == "error"

    _shift_wall_clock(monkeypatch, events_ingest, health_report, by_s=-3600)  # NTP moves the clock back an hour
    items = {i["id"]: i["status"] for i in c.get("/api/v1/health/summary").json()["items"]}
    assert items.get("nvr") == "error", f"the NVR is still down; the top bar went silent: {items}"
    assert 115 <= ingest_state.outage_s() <= 300
    record("C1 NVR down, clock back 1 h", summary_nvr=items.get("nvr"), outage_s=round(ingest_state.outage_s()))


def _gaps(db: Database) -> list[dict[str, Any]]:
    with db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT occurred_at, ended_at, details_json FROM events WHERE type = 'coverage_gap'").fetchall()]


def test_c2_a_long_outage_keeps_its_coverage_gap_when_the_clock_moves_back(settings, monkeypatch):
    app = create_app(settings)
    db = app.state.db
    st = events_ingest.IngestState()
    st.disconnected_since = time.time() - 120  # a two-minute outage ...
    _shift_wall_clock(monkeypatch, events_ingest, by_s=-3600)  # ... during which the clock went back an hour
    assert events_ingest.close_gap(db, st.disconnected_since, "ConnectError", PRIMARY, "test gap", outage_s=events_ingest.outage_of(st))
    gaps = _gaps(db)
    assert len(gaps) == 1, "a two-minute NVR outage is a coverage gap whatever the wall clock did (before: none - it read as -58 minutes)"
    seconds = json.loads(gaps[0]["details_json"])["seconds"]
    assert 115 <= seconds <= 300 and gaps[0]["occurred_at"] < gaps[0]["ended_at"]
    record("C2 long outage, clock back 1 h", gap_seconds=seconds, since=gaps[0]["occurred_at"], until=gaps[0]["ended_at"])


def test_c3_a_short_blip_is_not_an_hour_long_gap_when_the_clock_moves_forward(settings, monkeypatch):
    app = create_app(settings)
    db = app.state.db
    st = events_ingest.IngestState()
    st.disconnected_since = time.time() - 10  # a ten-second blip ...
    _shift_wall_clock(monkeypatch, events_ingest, by_s=3600)  # ... during which the clock went forward an hour
    assert events_ingest.close_gap(db, st.disconnected_since, "ConnectError", PRIMARY, "test gap", outage_s=events_ingest.outage_of(st))
    assert _gaps(db) == [], "below the 45 s threshold: no gap (before: an hour-long coverage gap that never happened)"
    since, until, length = events_ingest.gap_window(st.disconnected_since, st.outage_s())
    assert length < events_ingest.GAP_AFTER_S and since < until
    # without a jump the recorded span is the wall-clock one, exactly as before
    stamp = events_ingest.time.time() - 100  # a stamp of the (shifted, now steady) clock, measured 100 s by the monotonic one
    s2, u2, l2 = events_ingest.gap_window(stamp, 100.0)
    assert abs(l2 - 100.0) < 2 and abs((u2 - s2).total_seconds() - 100.0) < 2 and s2.timestamp() == pytest.approx(stamp)
    record("C3 short blip, clock forward 1 h", gap_rows=0, measured_s=round(length, 1))


def test_c4_a_reachable_video_service_is_rechecked_when_the_clock_moves_back():
    r = media_reach.Reach()
    r.record_ok(now=1_000_000.0)
    assert not r.due(now=1_000_010.0), "normal schedule: re-probe after OK_REFRESH_S"
    assert r.due(now=1_000_000.0 + media_reach.OK_REFRESH_S)
    assert r.due(now=1_000_000.0 - 3600), "clock back an hour: probe now (before: no probe for an hour - a silent 'reachable')"
    r.record_failure("ConnectError", now=1_000_100.0)
    assert r.view(types.SimpleNamespace(go2rtc_url="http://go2rtc.test"), now=1_000_100.0 - 3600)["down_for_s"] == 0, "never a negative duration"
    assert r.due(now=1_000_100.0 - 3600)
    record("C4 video service, clock back 1 h", probed=True)
