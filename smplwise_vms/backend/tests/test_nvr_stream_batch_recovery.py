"""CR-020 S2C (PLAN_C section 8 group 8, section 3 recovery): a batch never resumes a write by itself. A runner that died
after item k, a crash between the PUT and the outcome, an add-on shutdown in the middle, and a runner of another process
whose heartbeat went stale all end `interrupted`: applied items stay applied, the queued ones become `not_attempted`
(`interrupted`), a pending item is settled only by a device READ when due. Fakes only."""
from __future__ import annotations

import datetime as dt
import json
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from nvr_batch_helpers import audits, batch_rows, camera_ids, details, fast_unknown, make_app, puts, ready, setup_fake, start, statuses, targets, wait_done, wait_put  # noqa: F401
from nvr_batch_helpers import with_nvr

from smplwise.db import new_id, now_iso
from smplwise.services import nvr_batch, nvr_settings

sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from fake_devices import FakeDevices  # noqa: E402


@pytest.fixture()
def fake(monkeypatch) -> FakeDevices:
    f = FakeDevices()
    f.install(monkeypatch)
    setup_fake(f)
    return f


def _crash_after_first_item(monkeypatch, where: str) -> None:
    """The runner dies without recording the end (as if the process were killed): `_finish` does nothing, and the second
    item raises either before its device call (`write`) or between the PUT and the outcome (`outcome`)."""
    monkeypatch.setattr(nvr_batch, "_finish", lambda *a, **k: None)
    if where == "write":
        real = nvr_settings.write_stream
        calls = {"n": 0}

        def write(*a, **k):
            calls["n"] += 1
            if calls["n"] == 2:
                raise RuntimeError("process killed")
            return real(*a, **k)

        monkeypatch.setattr(nvr_settings, "write_stream", write)
    else:
        real_rec = nvr_settings._record_outcome
        calls = {"n": 0}

        def record(*a, **k):
            calls["n"] += 1
            if calls["n"] == 2:
                raise RuntimeError("process killed after the PUT")
            return real_rec(*a, **k)

        monkeypatch.setattr(nvr_settings, "_record_outcome", record)


def test_restart_after_item_1_interrupts_and_never_resumes(settings, fake, fast_unknown):
    with pytest.MonkeyPatch.context() as m:
        _crash_after_first_item(m, "write")
        app = make_app(settings)
        with TestClient(app) as c:
            ready(app, 5)
            ids = camera_ids(app)
            r = start(c, targets(c, ids, (1, 2, 3)))
            bid = r.json()["batch_id"]
            assert nvr_batch.wait_idle(15)
            with app.state.db.connection(mode="read") as conn:
                assert conn.execute("SELECT value FROM settings WHERE key LIKE 'nvr.batch.active.%'").fetchone()[0] == bid, "the dead runner left its lock"
            assert [x["status"] for x in batch_rows(app, bid)] == ["applied", "queued", "queued"]
    writes = list(fake.writes)
    app2 = make_app(settings)  # a fresh process on the same database: start-up recovery
    with TestClient(app2) as c2:
        body = c2.get(f"/api/v1/nvr/stream-batches/{bid}").json()
        assert (body["state"], body["stopped_reason"]) == ("interrupted", "interrupted")
        assert statuses(body) == [("applied", None), ("not_attempted", "interrupted"), ("not_attempted", "interrupted")]
        settle = [a for a in audits(app2, "nvr.stream.batch") if details(a)["phase"] == "settle"]
        assert len(settle) == 1 and settle[0]["actor_username"] is None
        with app2.state.db.connection(mode="read") as conn:
            assert conn.execute("SELECT COUNT(*) FROM settings WHERE key LIKE 'nvr.batch.active.%'").fetchone()[0] == 0, "the recorder is free again"
        assert body["can_rollback"] is True
        assert c2.get("/api/v1/nvr/stream-batches?active=1").json()["batches"] == []
    assert fake.writes == writes, "recovery made no device write"
    assert puts(fake) == ["101"]


def test_crash_between_put_and_outcome_is_settled_by_a_read(settings, fake, fast_unknown, monkeypatch):
    with pytest.MonkeyPatch.context() as m:
        _crash_after_first_item(m, "outcome")
        app = make_app(settings)
        with TestClient(app) as c:
            ready(app, 5)
            ids = camera_ids(app)
            r = start(c, targets(c, ids, (1, 2, 3)))
            bid = r.json()["batch_id"]
            assert nvr_batch.wait_idle(15)
            assert [x["status"] for x in batch_rows(app, bid)] == ["applied", "pending", "queued"]
    assert puts(fake) == ["101", "201"], "the device took item 1's PUT; the outcome was never recorded"
    later = dt.datetime.now(dt.timezone.utc) + dt.timedelta(seconds=nvr_settings.PENDING_SETTLE_S + 1)
    monkeypatch.setattr(nvr_settings, "_utcnow", lambda: later)
    app2 = make_app(settings)
    with TestClient(app2) as c2:
        body = c2.get(f"/api/v1/nvr/stream-batches/{bid}").json()
        assert body["state"] == "interrupted"
        assert statuses(body) == [("applied", None), ("applied", None), ("not_attempted", "interrupted")], "the pending item settled from a READ"
    assert puts(fake) == ["101", "201"], "no PUT during recovery"


def test_young_pending_item_waits_for_the_janitor(settings, fake, fast_unknown):
    with pytest.MonkeyPatch.context() as m:
        _crash_after_first_item(m, "outcome")
        app = make_app(settings)
        with TestClient(app) as c:
            ready(app, 5)
            ids = camera_ids(app)
            bid = start(c, targets(c, ids, (1, 2, 3))).json()["batch_id"]
            assert nvr_batch.wait_idle(15)
    app2 = make_app(settings)
    with TestClient(app2) as c2:
        body = c2.get(f"/api/v1/nvr/stream-batches/{bid}").json()
        assert body["state"] == "interrupted" and statuses(body)[1] == ("running", None), "a young pending row is left to the janitor"
        assert body["can_rollback"] is False
        assert nvr_settings.settle_pending(app2.state.db, with_nvr(settings), older_than_s=0) == 1
        assert statuses(c2.get(f"/api/v1/nvr/stream-batches/{bid}").json())[1] == ("applied", None)


def test_shutdown_in_the_middle_ends_after_the_current_camera(settings, fake, fast_unknown):
    app = make_app(settings)
    with TestClient(app) as c:
        ready(app, 5)
        ids = camera_ids(app)
        fake.nvr["put_hold_s"] = 1.0
        bid = start(c, targets(c, ids, (1, 2, 3))).json()["batch_id"]
        wait_put(fake, 1)
    # the client closed: the shutdown hook asked the runner to stop after the camera in flight
    assert nvr_batch.wait_idle(15)
    fake.nvr["put_hold_s"] = 0.0
    app2 = make_app(settings)
    with TestClient(app2) as c2:
        body = c2.get(f"/api/v1/nvr/stream-batches/{bid}").json()
        assert (body["state"], body["stopped_reason"]) == ("interrupted", "shutdown")
        assert statuses(body) == [("applied", None), ("not_attempted", "interrupted"), ("not_attempted", "interrupted")]
    assert puts(fake) == ["101"]


def _fake_running_batch(app, ids, beat: str, settings) -> str:
    bid = new_id()
    with app.state.db.connection() as conn:
        key = nvr_batch.lock_key(conn, with_nvr(settings), "nvr-1")
        conn.execute("INSERT INTO nvr_changes(id, kind, permission, target, path, status, note, created_at, recorder_id, camera_id, stream_ref, fields_json, etag_before, batch_id, batch_index)"
                     " VALUES (?, 'stream_encoding', 'nvr.configure', 'stream-101', '', 'queued', '', ?, 'nvr-1', ?, '101', '{}', ?, ?, 0)", (new_id(), now_iso(), ids[1], "0" * 16, bid))
        conn.execute("INSERT INTO settings(key, value) VALUES (?, ?)", (f"nvr.batch.{bid}", json.dumps({"kind": "write", "recorder_id": "nvr-1", "lock_key": key, "total": 1,
                                                                                                  "state": "running", "created_at": now_iso()})))
        conn.execute("INSERT INTO settings(key, value) VALUES (?, ?)", (key, bid))
        conn.execute("INSERT INTO settings(key, value) VALUES (?, ?)", (f"nvr.batch.{bid}.beat", beat))
    return bid


def test_janitor_interrupts_only_a_batch_whose_heartbeat_is_stale(settings, fake, fast_unknown):
    app = make_app(settings)
    with TestClient(app) as c:
        ready(app, 5)
        ids = camera_ids(app)
        fresh = _fake_running_batch(app, ids, now_iso(), settings)
        assert nvr_batch.recover_batches(app.state.db, with_nvr(settings)) == 0, "another worker's live runner is left alone"
        assert c.get(f"/api/v1/nvr/stream-batches/{fresh}").json()["state"] == "running"
        single = c.put(f"/api/v1/nvr/cameras/{ids[4]}/streams/401", json={"if_match": "0" * 16, "confirm": True, "changes": {"svc": False}})
        assert single.status_code == 409 and single.json()["code"] == "batch_in_progress"
        with app.state.db.connection() as conn:
            conn.execute("UPDATE settings SET value = '2026-01-01T00:00:00Z' WHERE key = ?", (f"nvr.batch.{fresh}.beat",))
        # review finding 3: the status route never recovers (it is read-only); the periodic recovery does
        assert c.get(f"/api/v1/nvr/stream-batches/{fresh}").json()["state"] == "running"
        assert nvr_batch.recover_batches(app.state.db, with_nvr(settings)) == 1
        body = c.get(f"/api/v1/nvr/stream-batches/{fresh}").json()
        assert (body["state"], statuses(body)) == ("interrupted", [("not_attempted", "interrupted")])
        assert fake.writes == []


def test_janitor_tick_runs_the_recovery(settings, fake, fast_unknown):
    from smplwise.main import janitor_tick

    app = make_app(settings)
    with TestClient(app) as c:
        ready(app, 5)
        ids = camera_ids(app)
        stale = _fake_running_batch(app, ids, "2026-01-01T00:00:00Z", settings)
        janitor_tick(app.state.db, with_nvr(settings))
        assert c.get(f"/api/v1/nvr/stream-batches/{stale}").json()["state"] == "interrupted"
        assert fake.writes == []
