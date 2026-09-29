"""The write gate (one writer at a time, in arrival order), the durability classes, the size-triggered WAL truncate and
the busy retry wrapper - smplwise/db.py, the 2026-09-29 root-cause fix of the round-10 lock storm."""
from __future__ import annotations

import sqlite3
import threading
import time

import pytest

from smplwise import db as db_mod
from smplwise.db import Database, WriteGate, retry_locked, set_setting, unlocked


@pytest.fixture()
def db(tmp_path) -> Database:
    d = Database(tmp_path / "t.db")
    d.migrate()
    return d


def test_gate_is_first_come_first_served():
    gate = WriteGate()
    first = gate.acquire(1)
    order: list[int] = []
    queued = threading.Semaphore(0)

    def waiter(i: int) -> None:
        queued.release()
        tok = gate.acquire(5)
        order.append(i)
        time.sleep(0.01)
        gate.release(tok)

    threads = []
    for i in range(6):
        t = threading.Thread(target=waiter, args=(i,))
        t.start()
        queued.acquire()
        # the waiter is in the queue once state() counts it
        deadline = time.monotonic() + 2
        while gate.state()["waiting"] < i + 1 and time.monotonic() < deadline:
            time.sleep(0.005)
        threads.append(t)
    gate.release(first)
    for t in threads:
        t.join(5)
    assert order == list(range(6))
    assert gate.state() == {"held": False, "waiting": 0}


def test_gate_times_out_leaves_the_queue_and_try_acquire_needs_quiet():
    gate = WriteGate()
    tok = gate.acquire(1)
    started = time.monotonic()
    assert gate.acquire(0.1) is None
    assert 0.09 <= time.monotonic() - started < 1.0
    assert gate.state() == {"held": True, "waiting": 0}
    assert gate.try_acquire() is None
    gate.release(object())  # a stranger's token releases nothing
    assert gate.state()["held"] is True
    gate.release(tok)
    quiet = gate.try_acquire()
    assert quiet is not None
    gate.release(quiet)


def test_an_interrupted_waiter_leaves_no_trace(monkeypatch):
    """Review L1: an exception while waiting (KeyboardInterrupt, SystemExit) removes the entry, or hands on a turn that
    arrived meanwhile - the gate never stays held by nobody."""
    gate = WriteGate()
    first = gate.acquire(1)

    class Interrupted:
        def __init__(self) -> None:
            self._flag = False

        def set(self) -> None:
            self._flag = True

        def wait(self, timeout=None):
            raise KeyboardInterrupt

    monkeypatch.setattr(db_mod.threading, "Event", Interrupted)
    with pytest.raises(KeyboardInterrupt):
        gate.acquire(5)
    assert gate.state() == {"held": True, "waiting": 0}

    class TurnThenInterrupted(Interrupted):
        def wait(self, timeout=None):
            gate.release(first)  # the turn arrives ...
            raise KeyboardInterrupt  # ... and the waiter dies before it sees it

    monkeypatch.setattr(db_mod.threading, "Event", TurnThenInterrupted)
    with pytest.raises(KeyboardInterrupt):
        gate.acquire(5)
    assert gate.state() == {"held": False, "waiting": 0}


def test_one_attempt_never_waits_longer_than_the_busy_timeout(db, monkeypatch):
    """Review M3: the gate queue and SQLite's busy wait share one BUSY_TIMEOUT_S budget, and busy_timeout is restored."""
    monkeypatch.setattr(db_mod, "BUSY_TIMEOUT_S", 1.0)
    outside = sqlite3.connect(db.path, isolation_level=None, check_same_thread=False)  # another process's writer: SQLite's busy wait applies
    holding, done = threading.Event(), threading.Event()

    def hold_gate() -> None:
        with db.connection(label="in-process holder") as conn:
            holding.set()
            done.wait(5)
            conn.execute("COMMIT")  # SQLite's lock is free, the gate is still held ...
            outside.execute("BEGIN IMMEDIATE")  # ... and the lock is taken outside the gate before it is handed on

    t = threading.Thread(target=hold_gate)
    t.start()
    holding.wait(5)
    threading.Timer(0.6, done.set).start()
    before = db_mod.lock_stats()
    started = time.monotonic()
    try:
        with pytest.raises(sqlite3.OperationalError, match="locked"):
            with db.connection(label="waiter"):
                pass
        assert time.monotonic() - started < 1.5  # not 0.6 s in the gate + a full 1 s in SQLite
    finally:
        t.join(5)
        if outside.in_transaction:
            outside.execute("ROLLBACK")
        outside.close()
    after = db_mod.lock_stats()
    assert after["busy_errors"] == before["busy_errors"] + 1 and after["gate_timeouts"] == before["gate_timeouts"]
    with db.connection() as conn:
        assert conn.execute("PRAGMA busy_timeout").fetchone()[0] == 1000


def test_a_gate_timeout_is_counted_apart_and_long_waits_are_counted(db, monkeypatch):
    monkeypatch.setattr(db_mod, "BUSY_TIMEOUT_S", 0.2)
    before = db_mod.lock_stats()
    with db.connection(label="holder"):
        with pytest.raises(sqlite3.OperationalError, match="locked"):
            with db.write_aside(label="victim"):
                pass
    after = db_mod.lock_stats()
    assert after["gate_timeouts"] == before["gate_timeouts"] + 1 and after["busy_errors"] == before["busy_errors"] + 1
    db_mod._note_wait(1.5, "slow waiter")
    stats = db_mod.lock_stats()
    assert stats["waits_over_1s"] >= 1 and stats["max_wait_recent_s"] >= 1.5 and stats["write_gate"] is True


def test_one_gate_per_database_file(tmp_path):
    a, b = Database(tmp_path / "x.db"), Database(tmp_path / "x.db")
    assert a.gate is b.gate
    assert Database(tmp_path / "y.db").gate is not a.gate


def test_a_waiting_writer_is_handed_the_lock_on_release_and_times_out_as_locked(db, monkeypatch):
    holding, done = threading.Event(), threading.Event()

    def hold() -> None:
        with db.connection(label="holder") as conn:
            set_setting(conn, "k", "holder")
            holding.set()
            done.wait(5)

    t = threading.Thread(target=hold)
    t.start()
    holding.wait(5)
    # a waiter past the busy timeout fails like SQLite does, and the accounting names the holder
    monkeypatch.setattr(db_mod, "BUSY_TIMEOUT_S", 0.2)
    before = db_mod.lock_stats()["busy_errors"]
    with pytest.raises(sqlite3.OperationalError, match="database is locked"):
        with db.connection(label="victim"):
            pass
    assert db_mod.lock_stats()["busy_errors"] == before + 1
    assert db_mod.lock_stats()["last_busy"]["holder"] == "holder"
    # a waiter within the timeout gets the lock as soon as it is released (no polling interval)
    monkeypatch.setattr(db_mod, "BUSY_TIMEOUT_S", 5.0)
    got: dict[str, float] = {}

    def wait_turn() -> None:
        with db.connection(label="next") as conn:
            got["at"] = time.monotonic()
            set_setting(conn, "k", "next")

    w = threading.Thread(target=wait_turn)
    w.start()
    deadline = time.monotonic() + 2
    while db.gate.state()["waiting"] < 1 and time.monotonic() < deadline:
        time.sleep(0.005)
    released = time.monotonic()
    done.set()
    t.join(5)
    w.join(5)
    assert got["at"] - released < 0.5
    with db.connection(mode="read") as conn:
        assert conn.execute("SELECT value FROM settings WHERE key = 'k'").fetchone()[0] == "next"
    assert db.gate.state() == {"held": False, "waiting": 0}


def test_every_exit_hands_the_gate_on(db):
    # commit, rollback on an error, write_aside, release() and unlocked() all free the gate
    with db.connection() as conn:
        assert db.gate.state()["held"]
    assert not db.gate.state()["held"]
    with pytest.raises(RuntimeError):
        with db.connection() as conn:
            raise RuntimeError("boom")
    assert not db.gate.state()["held"]
    with db.write_aside() as w:
        assert db.gate.state()["held"]
    assert not db.gate.state()["held"]
    with db.connection() as conn:
        db_mod.release(conn)
        assert not db.gate.state()["held"]
    with db.connection() as conn:
        with unlocked(conn):
            assert not db.gate.state()["held"]
            with db.connection() as other:  # another writer gets in while the device call runs
                set_setting(other, "during", "1")
        assert db.gate.state()["held"]
        set_setting(conn, "after", "1")
    assert db.gate.state() == {"held": False, "waiting": 0}
    with db.connection(mode="read") as conn:  # readers never touch the gate
        assert not db.gate.state()["held"]
        assert {r[0] for r in conn.execute("SELECT key FROM settings WHERE key IN ('during', 'after')")} == {"during", "after"}


def test_another_process_is_still_waited_for_by_sqlite(db, monkeypatch):
    """The gate is per process; a writer outside it (another process, a raw connection) is covered by busy_timeout."""
    monkeypatch.setattr(db_mod, "BUSY_TIMEOUT_S", 0.3)
    outside = sqlite3.connect(db.path, isolation_level=None)
    outside.execute("BEGIN IMMEDIATE")
    try:
        with pytest.raises(sqlite3.OperationalError, match="locked"):
            with db.connection(label="inside"):
                pass
        assert db.gate.state() == {"held": False, "waiting": 0}  # the failed BEGIN handed the gate back
    finally:
        outside.execute("ROLLBACK")
        outside.close()
    with db.connection() as conn:
        set_setting(conn, "k", "v")


def test_write_gate_switch_off_leaves_sqlite_alone(db, monkeypatch):
    """SW_DB_WRITE_GATE=0: the escape hatch - writers go straight to SQLite's busy handler, as before the gate."""
    monkeypatch.setattr(db_mod, "WRITE_GATE", False)
    with db.connection() as conn:
        assert db.gate.state() == {"held": False, "waiting": 0}
        set_setting(conn, "k", "v")
    with db.connection(mode="read") as conn:
        assert conn.execute("SELECT value FROM settings WHERE key = 'k'").fetchone()[0] == "v"


def test_durability_classes(db):
    with db.connection() as conn:
        assert conn.execute("PRAGMA synchronous").fetchone()[0] == 2  # FULL
        assert conn.execute("PRAGMA journal_size_limit").fetchone()[0] == db_mod.WAL_TRUNCATE_BYTES
    with db.connection(durable=False) as conn:
        assert conn.execute("PRAGMA synchronous").fetchone()[0] == 1  # NORMAL
    with db.write_aside() as w:
        assert w.execute("PRAGMA synchronous").fetchone()[0] == 2


def test_a_mirror_transaction_that_records_an_event_commits_full(db, monkeypatch):
    """Review M1: an HA state push that creates a correlation event (not sent again) is fsynced; a pure upsert is not."""
    from smplwise.services import ha_sync

    at_commit: list[int] = []
    real_finish = db_mod._finish

    def finish(conn, sql):
        if sql == "COMMIT" and conn.in_transaction and not db_mod.read_mode(conn):
            at_commit.append(conn.execute("PRAGMA synchronous").fetchone()[0])
        return real_finish(conn, sql)

    monkeypatch.setattr(db_mod, "_finish", finish)
    now = db_mod.now_iso()

    def push(eid, old, new, dc):
        attrs = {"friendly_name": eid, "device_class": dc}
        ha_sync.handle_state_event(db, {"entity_id": eid, "old_state": {"entity_id": eid, "state": old, "attributes": attrs, "last_changed": now, "last_updated": now},
                                        "new_state": {"entity_id": eid, "state": new, "attributes": attrs, "last_changed": now, "last_updated": now}})

    push("sensor.power_1", "1", "2", "power")
    push("binary_sensor.front_door", "off", "on", "door")
    with db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM events WHERE source = 'ha'").fetchone()[0] == 1
    assert at_commit == [1, 2]  # NORMAL for the mirror row alone, FULL once an event row was written


def test_durability_is_chosen_before_begin(db):
    """SQLite refuses to change synchronous inside a transaction, so the class is picked when the connection opens."""
    with db.connection(durable=False) as conn:
        with pytest.raises(sqlite3.OperationalError, match="inside a transaction"):
            conn.execute("PRAGMA synchronous=FULL")
    from smplwise.services.correlation import may_record

    door = lambda s: {"entity_id": "binary_sensor.front_door", "state": s, "attributes": {"device_class": "door"}}  # noqa: E731
    power = lambda s: {"entity_id": "sensor.power_1", "state": s, "attributes": {"device_class": "power"}}  # noqa: E731
    assert may_record(door("off"), door("on"))
    assert not may_record(None, door("on")) and not may_record(door("on"), door("on"))
    assert not may_record(power("1"), power("2"))


def test_the_alert_stream_writes_full(settings, monkeypatch):
    """NVR alerts are never sent again: their transaction is fsynced."""
    import datetime as dt

    from fastapi.testclient import TestClient
    from smplwise.main import create_app
    from smplwise.services import events_ingest

    app = create_app(settings)
    TestClient(app).post("/api/v1/cameras", json={"channel": 1, "alias": "cam1"})
    at_commit: list[int] = []
    real_finish = db_mod._finish

    def finish(conn, sql):
        if sql == "COMMIT" and conn.in_transaction and not db_mod.read_mode(conn):
            at_commit.append(conn.execute("PRAGMA synchronous").fetchone()[0])
        return real_finish(conn, sql)

    monkeypatch.setattr(db_mod, "_finish", finish)
    monkeypatch.setattr(events_ingest.LISTENER, "db", app.state.db)
    monkeypatch.setattr(events_ingest.LISTENER, "settings", settings)
    monkeypatch.setattr(events_ingest.LISTENER, "tz_getter", lambda: "Asia/Jerusalem")
    events_ingest.LISTENER._handle(events_ingest.ParsedAlert(raw_type="VMD", state="active", channel=1, dyn_channel=None,
                                                             device_time=dt.datetime.now(dt.timezone(dt.timedelta(hours=3))).replace(microsecond=0).isoformat(),
                                                             description="", target="", active_post_count=1))
    assert at_commit and set(at_commit) == {2}


def test_mirror_writers_use_normal_and_user_actions_stay_full(db, monkeypatch):
    from smplwise.services import ha_sync

    seen: list[int] = []
    real_open = Database._open

    def spy(self, durable=True):
        conn = real_open(self, durable)
        seen.append(conn.execute("PRAGMA synchronous").fetchone()[0])
        return conn

    monkeypatch.setattr(Database, "_open", spy)
    ha_sync.handle_state_event(db, {"entity_id": "sensor.x", "old_state": None, "new_state": {"entity_id": "sensor.x", "state": "1", "attributes": {}}})
    assert seen == [1]
    seen.clear()
    ha_sync.store_states(db, [{"entity_id": "sensor.y", "state": "2", "attributes": {}}], db_mod.now_iso())
    assert seen and seen[0] == 1


@pytest.fixture()
def keeper(db):
    """An idle open connection: SQLite deletes the WAL when its last connection closes, so without one there is none."""
    c = sqlite3.connect(db.path, isolation_level=None)
    c.execute("SELECT 1 FROM settings LIMIT 1").fetchall()
    yield c
    c.close()


def _grow_wal(db: Database, rows: int = 300) -> None:
    with db.connection() as conn:
        for i in range(rows):
            set_setting(conn, f"pad{i}", "x" * 2000)


def test_checkpoint_is_passive_below_the_size_trigger(db):
    _grow_wal(db, 20)
    out = db.checkpoint()
    assert out["mode"] == "PASSIVE" and out["busy"] is False


def test_checkpoint_truncates_a_large_wal_at_a_quiet_moment(db, keeper, monkeypatch):
    monkeypatch.setattr(db_mod, "WAL_TRUNCATE_BYTES", 64 * 1024)
    _grow_wal(db)
    assert db._wal_bytes() >= 64 * 1024
    out = db.checkpoint()
    assert out["mode"] == "TRUNCATE" and out["busy"] is False and out["wal_bytes_after"] == 0
    assert db.gate.state() == {"held": False, "waiting": 0}


def test_checkpoint_never_waits_for_a_busy_writer(db, keeper, monkeypatch):
    monkeypatch.setattr(db_mod, "WAL_TRUNCATE_BYTES", 64 * 1024)
    _grow_wal(db)
    assert db._wal_bytes() >= 64 * 1024
    holding, done = threading.Event(), threading.Event()

    def hold() -> None:
        with db.connection():
            holding.set()
            done.wait(5)

    t = threading.Thread(target=hold)
    t.start()
    holding.wait(5)
    try:
        started = time.monotonic()
        out = db.checkpoint()
        assert out["mode"] == "PASSIVE"  # not quiet: no truncate, the next tick tries again
        assert time.monotonic() - started < 1.0
    finally:
        done.set()
        t.join(5)


def test_checkpoint_quiet_check_holds_with_the_gate_switched_off(db, keeper, monkeypatch):
    monkeypatch.setattr(db_mod, "WAL_TRUNCATE_BYTES", 64 * 1024)
    monkeypatch.setattr(db_mod, "WRITE_GATE", False)
    _grow_wal(db)
    with db.connection():  # a writer holds the lock; the gate is not in use, the holders are
        assert not db.gate.state()["held"]
        out = db.checkpoint()
        assert out["mode"] == "PASSIVE"
    assert db.checkpoint()["mode"] == "TRUNCATE"


def test_checkpoint_does_not_truncate_behind_a_long_reader(db, keeper, monkeypatch):
    """Review L2: PASSIVE first; a reader holding an older snapshot keeps it from reaching the end, so no TRUNCATE (which
    would wait for that reader) - the next quiet tick after the reader ends truncates."""
    monkeypatch.setattr(db_mod, "WAL_TRUNCATE_BYTES", 64 * 1024)
    monkeypatch.setattr(db_mod, "CHECKPOINT_BUSY_S", 0.2)
    reader = sqlite3.connect(db.path, isolation_level=None)
    reader.execute("BEGIN")
    reader.execute("SELECT COUNT(*) FROM settings").fetchone()  # a read snapshot from before the writes below
    try:
        _grow_wal(db)
        started = time.monotonic()
        out = db.checkpoint()
        assert out["mode"] == "PASSIVE" and out["checkpointed"] < out["frames"]
        assert time.monotonic() - started < 1.0
        assert db.gate.state() == {"held": False, "waiting": 0}
        with db.connection() as conn:  # writers are not stuck behind it
            set_setting(conn, "after", "1")
    finally:
        reader.execute("ROLLBACK")
        reader.close()
    assert db.checkpoint()["wal_bytes_after"] == 0


def test_retry_locked_backs_off_with_jitter_and_a_cap(monkeypatch):
    sleeps: list[float] = []
    monkeypatch.setattr(db_mod.time, "sleep", sleeps.append)
    monkeypatch.setattr(db_mod.random, "random", lambda: 0.5)  # jitter factor 1.0
    calls = {"n": 0}

    def busy_then_ok() -> str:
        calls["n"] += 1
        if calls["n"] < 5:
            raise sqlite3.OperationalError("database is locked")
        return "ok"

    assert retry_locked(busy_then_ok, attempts=5, base_s=1.5) == "ok"
    assert sleeps == [1.5, 3.0, 4.0, 4.0]  # doubling, capped at 4 s
    monkeypatch.setattr(db_mod.random, "random", lambda: 0.0)
    sleeps.clear()
    calls["n"] = 3
    assert retry_locked(busy_then_ok, attempts=5, base_s=1.0) == "ok"
    assert sleeps == [0.5]  # jitter spans 0.5x .. 1.5x


def test_retry_locked_rides_out_a_holder_that_lets_go(db, monkeypatch):
    monkeypatch.setattr(db_mod, "BUSY_TIMEOUT_S", 0.2)
    holding, done = threading.Event(), threading.Event()

    def hold() -> None:
        with db.connection(label="brief holder"):
            holding.set()
            done.wait(5)

    t = threading.Thread(target=hold)
    t.start()
    holding.wait(5)
    threading.Timer(0.3, done.set).start()

    def write() -> None:
        with db.connection() as conn:
            set_setting(conn, "k", "retried")

    retry_locked(write, attempts=4, base_s=0.1)
    t.join(5)
    with db.connection(mode="read") as conn:
        assert conn.execute("SELECT value FROM settings WHERE key = 'k'").fetchone()[0] == "retried"


def test_no_manual_transaction_control_outside_db_py():
    """COMMIT / ROLLBACK / BEGIN IMMEDIATE by hand keep (or bypass) the write gate: use db.commit_now,
    db.rollback_and_restart, unlocked() or a new connection. A deferred BEGIN and savepoints stay allowed."""
    import re
    from pathlib import Path

    root = Path(db_mod.__file__).resolve().parent
    pattern = re.compile(r"""\.execute(?:script)?\(\s*[rbf]?["']\s*(COMMIT|ROLLBACK|END|BEGIN\s+(?:IMMEDIATE|EXCLUSIVE))\b""", re.IGNORECASE)
    offenders = []
    for path in sorted(root.rglob("*.py")):
        if path.name == "db.py" and path.parent == root:
            continue
        for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if pattern.search(line) and "ROLLBACK TO" not in line.upper():
                offenders.append(f"{path.relative_to(root)}:{n}: {line.strip()}")
    assert offenders == []


def test_commit_now_hands_the_gate_on_and_keeps_reading(db):
    with db.connection() as conn:
        set_setting(conn, "k", "1")
        db_mod.commit_now(conn)
        assert db.gate.state() == {"held": False, "waiting": 0} and conn.in_transaction
        with db.write_aside() as w:  # the same thread can write elsewhere at once: no self-deadlock
            set_setting(w, "k2", "2")
        conn.execute("SELECT 1").fetchone()
    with db.connection() as conn:
        db_mod.commit_now(conn, keep_reading=False)
        assert not conn.in_transaction and not db.gate.state()["held"]
    with db.connection() as conn:
        set_setting(conn, "gone", "1")
        db_mod.rollback_and_restart(conn)
        assert conn.in_transaction and db.gate.state()["held"]
        set_setting(conn, "kept", "1")
    with db.connection(mode="read") as conn:
        assert {r[0] for r in conn.execute("SELECT key FROM settings WHERE key IN ('k', 'k2', 'gone', 'kept')")} == {"k", "k2", "kept"}


def test_a_gate_kept_after_a_manual_commit_is_reported(db, monkeypatch, caplog):
    import logging

    monkeypatch.setattr(db_mod, "BUSY_TIMEOUT_S", 1.5)
    with db.connection(label="manual committer") as conn:
        conn.execute("COMMIT")  # the bug the helpers prevent: the token stays with a connection that no longer writes
        with caplog.at_level(logging.ERROR, logger="smplwise.db"):
            with pytest.raises(sqlite3.OperationalError, match="locked"):
                with db.write_aside(label="victim"):
                    pass
        assert any("manual committer" in r.getMessage() and "outside a transaction" in r.getMessage() for r in caplog.records)
    assert db.gate.state() == {"held": False, "waiting": 0}
