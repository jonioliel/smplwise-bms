"""WRITE-GATE-EVENTS-2341: the stray-holder detector (db._report_stray_holders) must report a connection that keeps the
write gate after a manual COMMIT - and nothing else. SQLite clears its "in a transaction" flag (sqlite3_get_autocommit)
when COMMIT STARTS, before the WAL write and the fsync, so a holder in the middle of committing read as "outside a
transaction" - and so did one that had just committed and not yet handed the gate on, and one that had just taken the
gate and not yet started BEGIN IMMEDIATE. The alert stream commits FULL (fsynced) once per alert, so during a burst a
writer that waited a second behind it logged "write gate held by events_ingest._write outside a transaction"."""
from __future__ import annotations

import datetime as dt
import logging
import sqlite3
import threading
from dataclasses import replace

import pytest

from smplwise import db as db_mod
from smplwise.db import Database, set_setting

STRAY = "outside a transaction"


@pytest.fixture()
def db(tmp_path) -> Database:
    d = Database(tmp_path / "t.db")
    d.migrate()
    return d


def _strays(caplog) -> list[str]:
    return [r.getMessage() for r in caplog.records if STRAY in r.getMessage()]


class _Probe:
    """Runs the detector from another thread in a tight loop, as every writer that waited a second would."""

    def __init__(self, gate: db_mod.WriteGate) -> None:
        self.gate, self.stop, self.runs = gate, threading.Event(), 0
        self.thread = threading.Thread(target=self._run, daemon=True)

    def _run(self) -> None:
        while not self.stop.is_set():
            db_mod._report_stray_holders(self.gate, "probe")
            db_mod._stray_logged.clear()  # every sighting counts here, not only the first per connection
            self.runs += 1

    def __enter__(self) -> "_Probe":
        self.thread.start()
        return self

    def __exit__(self, *exc: object) -> None:
        self.stop.set()
        self.thread.join(10)


def test_sqlite_reports_no_transaction_while_a_commit_is_still_running(tmp_path):
    """The premise of the fix, pinned: while a COMMIT is being written, in_transaction already reads False."""
    conn = sqlite3.connect(tmp_path / "p.db", isolation_level=None, check_same_thread=False)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=FULL")
    conn.execute("PRAGMA cache_size=-100000")  # the pages stay in memory until COMMIT writes them to the WAL
    conn.execute("CREATE TABLE t(x BLOB)")
    conn.execute("BEGIN IMMEDIATE")
    conn.executemany("INSERT INTO t VALUES (randomblob(4000))", [()] * 2000)
    assert conn.in_transaction
    seen: list[bool] = []
    go, done = threading.Event(), threading.Event()

    def sample() -> None:
        go.wait()
        while not done.is_set():
            seen.append(conn.in_transaction)

    t = threading.Thread(target=sample)
    t.start()
    go.set()
    conn.execute("COMMIT")
    done.set()
    t.join(10)
    conn.close()
    assert False in seen, "SQLite reports autocommit while its COMMIT is still running"


def test_a_holder_in_the_middle_of_its_commit_is_not_a_stray(db, caplog):
    """Large FULL commits under a detector that runs all the time: never reported."""
    with caplog.at_level(logging.ERROR, logger="smplwise.db"):
        with _Probe(db.gate) as probe:
            for round_ in range(5):
                with db.connection(label="big committer") as conn:
                    conn.execute("PRAGMA cache_size=-100000")
                    conn.execute("CREATE TABLE IF NOT EXISTS blobs(x BLOB)")
                    conn.executemany("INSERT INTO blobs VALUES (randomblob(4000))", [()] * 1500)
                    set_setting(conn, "round", str(round_))
        assert probe.runs > 0
    assert _strays(caplog) == []


def test_the_commit_to_hand_on_window_is_not_a_stray(db, monkeypatch, caplog):
    """Deterministic: the detector runs after COMMIT / ROLLBACK returned and before the gate is handed on - on every
    exit path (connection(), write_aside(), commit_now, rollback_and_restart, release, unlocked). Finishing, not a stray."""
    seen: list[str] = []
    real_end = db_mod._end_hold

    def end_hold(conn):
        if id(conn) in db_mod._gate_tokens and not conn.in_transaction:
            db_mod._report_stray_holders(db.gate, "probe")
            seen.append("end")
        return real_end(conn)

    monkeypatch.setattr(db_mod, "_end_hold", end_hold)
    with caplog.at_level(logging.ERROR, logger="smplwise.db"):
        with db.connection(label="finishing writer") as conn:
            set_setting(conn, "a", "1")
        with db.write_aside(label="aside writer") as conn:
            set_setting(conn, "b", "1")
        with db.connection(label="commit_now writer") as conn:
            set_setting(conn, "c", "1")
            db_mod.commit_now(conn)
        with db.connection(label="restart writer") as conn:
            set_setting(conn, "d", "1")
            db_mod.rollback_and_restart(conn)
        with db.connection(label="unlocked writer") as conn:
            set_setting(conn, "e", "1")
            with db_mod.unlocked(conn):
                pass
        with db.connection(label="released writer") as conn:
            set_setting(conn, "f", "1")
            db_mod.release(conn)
        with pytest.raises(RuntimeError):
            with db.connection(label="failing writer") as conn:
                set_setting(conn, "g", "1")
                raise RuntimeError("boom")
    assert seen.count("end") >= 7
    assert _strays(caplog) == []


def test_a_holder_that_took_the_gate_but_has_not_begun_is_not_a_stray(db, monkeypatch, caplog):
    """The gate token is recorded before BEGIN IMMEDIATE runs (which may wait for a writer in another process): the
    connection is beginning, not a stray. Since the fix it is marked "beginning" before the token is recorded at all."""
    checked: list[bool] = []
    real_open = db.__class__._open

    def open_(self, durable: bool = True):
        conn = real_open(self, durable)
        return _Tracing(conn)

    class _Tracing:
        """A connection whose BEGIN IMMEDIATE first lets the detector look (the token is stored by then)."""

        def __init__(self, conn: sqlite3.Connection) -> None:
            self._c = conn

        def execute(self, sql: str, *a):
            if sql == "BEGIN IMMEDIATE":
                db_mod._report_stray_holders(db.gate, "probe")
                checked.append(True)
            return self._c.execute(sql, *a)

        def __getattr__(self, name: str):
            return getattr(self._c, name)

    monkeypatch.setattr(db.__class__, "_open", open_)
    with caplog.at_level(logging.ERROR, logger="smplwise.db"):
        with db.connection(label="beginning writer") as conn:
            set_setting(conn, "x", "1")
    assert checked
    assert _strays(caplog) == []


def test_a_manual_commit_is_still_reported_by_the_detector(db, caplog):
    """The detector keeps doing its job: a bare COMMIT leaves the token with a connection that no longer writes."""
    with caplog.at_level(logging.ERROR, logger="smplwise.db"):
        with db.connection(label="manual committer") as conn:
            set_setting(conn, "m", "1")
            conn.execute("COMMIT")
            db_mod._report_stray_holders(db.gate, "probe")
    assert any("manual committer" in m for m in _strays(caplog))
    assert db.gate.state() == {"held": False, "waiting": 0}


def _alert(ch: int, when: dt.datetime, st: str = "active"):
    from smplwise.services import events_ingest

    return events_ingest.ParsedAlert(raw_type="VMD", state=st, channel=ch, dyn_channel=None, device_time=when.isoformat(), description="",
                                     target="", active_post_count=1)


def test_an_alert_burst_never_reads_as_a_stray_holder(settings, monkeypatch, caplog):
    """The field symptom: a burst of NVR alerts (one FULL commit per alert) with another writer contending and the
    detector running the whole time - no "write gate held by events_ingest._write outside a transaction". A rule with an
    HA notification fires on every alert: the HA call runs after the commit, never while the alert stream holds the gate."""
    from fastapi.testclient import TestClient

    from smplwise.main import create_app
    from smplwise.services import events_ingest, rules

    s = replace(settings, nvr_host="nvr.local", nvr_user="u", nvr_password="p")
    app = create_app(s)
    c = TestClient(app)
    for ch in range(1, 5):
        c.post("/api/v1/cameras", json={"channel": ch, "alias": f"c{ch}"})
    import json

    with app.state.db.connection() as conn:  # a rule as the API stores it (rules.ha_notify is a sensitive permission)
        now = db_mod.now_iso()
        conn.execute(
            "INSERT INTO rules(id, name, trigger_json, scope_json, window_json, cooldown_s, actions_json, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
            (db_mod.new_id(), "burst", json.dumps({"types": ["motion"], "sources": [], "severity_min": "info"}), "{}", json.dumps({"kind": "always"}), 0,
             json.dumps([{"kind": "notify", "message": "m"}, {"kind": "ha_notify", "service": "mobile_app_test", "message": "m"}]), now, now),
        )
    under_gate: list[bool] = []

    def ha_notify(service: str, message: str, title: str) -> dict:
        labels = [lbl for lbl, _since in db_mod._holders.copy().values()]
        labels += [db_mod._MODES.get(k, ("write", None, "?"))[2] for k in db_mod._gate_tokens.copy()]
        under_gate.append("events_ingest._write" in labels)
        return {"ok": True}

    monkeypatch.setattr(rules, "HA_NOTIFY", ha_notify)
    database: Database = app.state.db
    listener = events_ingest.AlertStreamListener()
    listener.db, listener.settings, listener.tz_getter = database, s, lambda: "Asia/Jerusalem"
    monkeypatch.setattr(events_ingest, "publish", lambda ev: None)
    base = dt.datetime.now(dt.timezone(dt.timedelta(hours=3))).replace(microsecond=0) - dt.timedelta(hours=3)
    stop = threading.Event()

    def other_writer() -> None:
        i = 0
        while not stop.is_set():
            with database.connection(label="other writer") as conn:
                set_setting(conn, "other", str(i))
            i += 1

    with caplog.at_level(logging.ERROR, logger="smplwise.db"):
        w = threading.Thread(target=other_writer, daemon=True)
        with _Probe(database.gate) as probe:
            w.start()
            for n in range(120):
                listener._handle(_alert(1 + n % 4, base + dt.timedelta(seconds=60 * n)))
            stop.set()
            w.join(10)
        assert probe.runs > 0
    with database.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM events WHERE source = 'alertstream'").fetchone()[0] == 120
    assert under_gate and not any(under_gate), "the HA notification ran while the alert stream held the write gate"
    strays = _strays(caplog)
    assert strays == [], strays[:3]
    assert database.gate.state() == {"held": False, "waiting": 0}
