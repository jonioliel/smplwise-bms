"""DB-CONN-POOL-2343: connection reuse (smplwise/db.py, "connection reuse"). A request connection is a lease of a pooled
SQLite connection; the lease keeps the per-request semantics (a new object per request, closed for everyone at its end,
its cursors closed) and a connection is only pooled again in exactly the state Database._open() leaves."""
from __future__ import annotations

import json
import sqlite3
import threading
from dataclasses import replace
from pathlib import Path

import pytest

from smplwise import db as db_mod
from smplwise.db import Database, PooledConnection, commit_now, release, set_setting, unlocked
from smplwise.errors import ApiError


@pytest.fixture(autouse=True)
def _pool_on(monkeypatch):
    monkeypatch.setattr(db_mod, "CONN_POOL", True)


@pytest.fixture()
def db(tmp_path) -> Database:
    d = Database(tmp_path / "t.db", pool=True)
    d.migrate()
    yield d
    d.close_pool()


def _raw(conn: sqlite3.Connection) -> sqlite3.Connection:
    assert isinstance(conn, PooledConnection)
    return conn._raw  # type: ignore[return-value]


def _idle(db: Database) -> int:
    return sum(len(v) for v in db._idle.values())


def test_a_connection_is_reused_and_every_lease_is_a_new_object(db):
    with db.connection(mode="read") as a:
        raw_a = _raw(a)
        assert isinstance(a, sqlite3.Connection)  # isinstance checks in product code keep working
    with db.connection() as b:
        assert _raw(b) is raw_a  # the same SQLite connection: the schema is not parsed again
        assert b is not a
        set_setting(b, "k", "v")
    with db.write_aside() as c:
        assert _raw(c) is raw_a
    assert _idle(db) == 1


def test_a_lease_kept_past_its_end_fails_like_a_closed_connection(db):
    with db.connection() as conn:
        set_setting(conn, "k", "1")
    with pytest.raises(sqlite3.ProgrammingError, match="closed database"):
        conn.execute("SELECT 1")
    with pytest.raises(sqlite3.ProgrammingError):
        _ = conn.in_transaction
    with db.connection(mode="read") as other:  # the next request has the connection; the stale reference cannot reach it
        assert other.execute("SELECT value FROM settings WHERE key = 'k'").fetchone()[0] == "1"
        with pytest.raises(sqlite3.ProgrammingError):
            conn.execute("SELECT 1")


def test_a_half_read_cursor_is_closed_so_no_old_snapshot_survives(db):
    with db.connection() as w:
        for i in range(50):
            set_setting(w, f"r{i}", "x")
    with db.connection(mode="read") as r:
        cur = r.execute("SELECT key FROM settings")
        cur.fetchone()  # more rows pending: the statement still holds the read snapshot
        raw = _raw(r)
    with pytest.raises(sqlite3.ProgrammingError):
        cur.fetchone()
    outside = sqlite3.connect(db.path, isolation_level=None)
    try:
        outside.execute("INSERT INTO settings(key, value) VALUES('late', '1')")
    finally:
        outside.close()
    with db.connection(mode="read") as again:
        assert _raw(again) is raw
        assert again.execute("SELECT value FROM settings WHERE key = 'late'").fetchone() is not None  # a fresh snapshot


def test_state_is_reset_before_the_connection_is_pooled(db):
    with db.connection(mode="read") as r:
        assert r.execute("PRAGMA query_only").fetchone()[0] == 1
        r.execute("PRAGMA busy_timeout=5")
        r.row_factory = None
    with db.connection() as w:  # the same connection, writable again, with _open()'s settings
        assert w.execute("PRAGMA query_only").fetchone()[0] == 0
        assert w.execute("PRAGMA busy_timeout").fetchone()[0] == int(db_mod.BUSY_TIMEOUT_S * 1000)
        assert w.row_factory is sqlite3.Row
        assert w.execute("PRAGMA foreign_keys").fetchone()[0] == 1
        set_setting(w, "k", "v")
        release(w)  # query-only for the rest of the request
    with db.connection() as w2:
        assert w2.execute("PRAGMA query_only").fetchone()[0] == 0
        set_setting(w2, "k", "w")
    with db.connection(durable=False) as m:
        assert m.execute("PRAGMA synchronous").fetchone()[0] == 1
    with db.connection(durable=False) as m2:
        assert _raw(m2) is not None and m2.execute("PRAGMA synchronous").fetchone()[0] == 1
    with db.connection() as f:
        assert f.execute("PRAGMA synchronous").fetchone()[0] == 2  # the durable class never gets a mirror connection


def test_secure_delete_switched_on_by_a_request_is_back_to_the_default(db):
    with db.connection(mode="read") as r:
        default = r.execute("PRAGMA secure_delete").fetchone()[0]
    with db.connection() as w:
        w.execute(f"PRAGMA secure_delete={1 - default}")
    with db.connection() as again:
        assert again.execute("PRAGMA secure_delete").fetchone()[0] == default


def test_foreign_keys_switched_off_by_a_request_are_on_again(db):
    with db.connection(mode="read") as r:
        r.execute("COMMIT")
        r.execute("PRAGMA foreign_keys=OFF")
        r.execute("BEGIN")
    with db.connection() as w:
        assert w.execute("PRAGMA foreign_keys").fetchone()[0] == 1


@pytest.mark.parametrize("touch,autocommit", [
    (lambda c: c.create_function("sw_x", 1, lambda v: v), False),
    (lambda c: c.set_trace_callback(None), False),
    (lambda c: c.execute("CREATE TEMP TABLE scratch(x)"), False),
    (lambda c: c.execute("ATTACH DATABASE ':memory:' AS other"), True),  # ATTACH is refused inside a transaction
], ids=["function", "trace", "temp-table", "attach"])
def test_connection_wide_state_is_never_pooled(db, touch, autocommit):
    with db.connection(mode="read"):
        pass
    assert _idle(db) == 1
    with db.connection() as conn:
        raw = _raw(conn)
        if autocommit:
            commit_now(conn, keep_reading=False)
        touch(conn)
    assert _idle(db) == 0  # closed, not handed back
    with pytest.raises(sqlite3.ProgrammingError):
        raw.execute("SELECT 1")


def test_executescript_is_forwarded_and_the_connection_closed_after(db):
    with db.connection() as conn:
        commit_now(conn, keep_reading=False)
        conn.executescript("SELECT 1;")
    assert _idle(db) == 0


def test_errors_decide_reuse(db):
    with pytest.raises(ApiError):
        with db.connection() as conn:
            set_setting(conn, "audit", "kept")
            raise ApiError(403, "forbidden", "no")
    assert _idle(db) == 1  # an expected API error commits and keeps the connection
    with pytest.raises(ValueError):
        with db.connection() as conn:
            raise ValueError("bug")
    assert _idle(db) == 1  # rolled back, clean
    with pytest.raises(sqlite3.OperationalError):
        with db.connection() as conn:
            raise sqlite3.OperationalError("database is locked")
    assert _idle(db) == 1  # busy: nothing wrong with the connection
    with pytest.raises(sqlite3.DatabaseError):
        with db.connection() as conn:
            raise sqlite3.DatabaseError("disk I/O error")
    assert _idle(db) == 0  # a database error closes it
    with pytest.raises(KeyboardInterrupt):
        with db.connection() as conn:
            raise KeyboardInterrupt
    assert _idle(db) == 0
    with db.connection(mode="read") as conn:
        assert conn.execute("SELECT value FROM settings WHERE key = 'audit'").fetchone()[0] == "kept"


def test_a_lease_closed_by_hand_mid_transaction_is_rolled_back_and_not_pooled(db):
    with pytest.raises(sqlite3.ProgrammingError):
        with db.connection() as conn:
            set_setting(conn, "lost", "1")
            conn.close()
    assert _idle(db) == 0 and db.gate.state() == {"held": False, "waiting": 0}
    with db.connection(mode="read") as r:
        assert r.execute("SELECT 1 FROM settings WHERE key = 'lost'").fetchone() is None


def test_the_gate_is_handed_on_and_no_stray_is_reported(db, caplog):
    for _ in range(3):
        with db.connection() as conn:
            set_setting(conn, "k", "v")
            with unlocked(conn):
                pass
        with db.write_aside() as w:
            set_setting(w, "k2", "v")
    assert db.gate.state() == {"held": False, "waiting": 0}
    assert not db_mod._gate_tokens and not db_mod._holders
    assert "outside a transaction" not in caplog.text


def test_idle_connections_are_bounded(db, monkeypatch):
    monkeypatch.setattr(db_mod, "POOL_IDLE_DURABLE", 2)
    from contextlib import ExitStack

    with ExitStack() as stack:
        for _ in range(5):
            stack.enter_context(db.connection(mode="read"))
    assert _idle(db) == 2


def test_a_schema_change_and_a_migration_drop_the_idle_connections(db):
    with db.connection(mode="read"):
        pass
    with db.connection(mode="read"):
        pass
    with db.connection() as conn:
        raw = _raw(conn)
        conn.execute("CREATE TABLE pool_probe(x)")
    assert _idle(db) == 0
    with pytest.raises(sqlite3.ProgrammingError):
        raw.execute("SELECT 1")
    with db.connection(mode="read") as conn:
        conn.execute("SELECT * FROM pool_probe").fetchall()
    assert _idle(db) == 1
    gen = db._pool_gen
    db.ensure_migration_objects()  # nothing missing: nothing invalidated
    assert _idle(db) == 1
    db.invalidate_pool()
    assert _idle(db) == 0 and db._pool_gen > gen


def test_a_lease_from_before_an_invalidation_is_closed_when_it_ends(db):
    with db.connection(mode="read") as conn:
        db.invalidate_pool()
    assert _idle(db) == 0
    del conn


def test_demo_switch_closes_idle_connections_and_old_leases(db, tmp_path):
    other = tmp_path / "demo.db"
    Database(other).migrate()  # an unpooled handle, as demo_mode builds the file
    with db.connection(mode="read"):
        pass
    assert _idle(db) == 1
    with db.connection(mode="read") as before:
        db.switch_path(other, demo=True)
        assert _idle(db) == 0
    assert _idle(db) == 0  # opened on the real file: never pooled for the demo file
    with db.connection() as conn:
        set_setting(conn, "where", "demo")
    db.switch_path(db.real_path, demo=False)
    with db.connection(mode="read") as conn:
        assert conn.execute("SELECT 1 FROM settings WHERE key = 'where'").fetchone() is None
    del before


def test_a_file_replaced_on_disk_is_never_served_from_the_pool(db, monkeypatch):
    with db.connection(mode="read") as conn:
        raw = _raw(conn)
    assert _idle(db) == 1
    real = db_mod._file_ident
    monkeypatch.setattr(db_mod, "_file_ident", lambda p: (real(p) or (0, 0))[:1] + (-1,))
    with db.connection(mode="read") as conn:
        assert _raw(conn) is not raw
    with pytest.raises(sqlite3.ProgrammingError):
        raw.execute("SELECT 1")


def test_kill_switch_opens_a_plain_connection_per_request(db, monkeypatch):
    monkeypatch.setattr(db_mod, "CONN_POOL", False)
    with db.connection() as a:
        assert type(a) is sqlite3.Connection
        set_setting(a, "k", "v")
    with pytest.raises(sqlite3.ProgrammingError):
        a.execute("SELECT 1")
    with db.write_aside() as w:
        assert type(w) is sqlite3.Connection
    assert _idle(db) == 0


def test_a_handle_for_one_job_opens_per_transaction_unless_asked(tmp_path, monkeypatch):
    """The backup drill's scratch copy, the demo-file builder ...: nothing of theirs stays open after the job."""
    monkeypatch.setattr(db_mod, "POOL_EVERY_HANDLE", False)
    d = Database(tmp_path / "one-job.db")
    d.migrate()
    with d.connection() as conn:
        assert type(conn) is sqlite3.Connection
    assert _idle(d) == 0
    import shutil

    shutil.rmtree(tmp_path)  # Windows: an open handle would refuse this
    monkeypatch.setattr(db_mod, "POOL_EVERY_HANDLE", True)
    assert Database(tmp_path / "x.db").pool is True and Database(tmp_path / "y.db", pool=False).pool is False


def test_kill_switch_while_leases_are_out_closes_them(db, monkeypatch):
    with db.connection(mode="read"):
        monkeypatch.setattr(db_mod, "CONN_POOL", False)
    assert _idle(db) == 0


def test_concurrent_readers_and_writers_lose_nothing(db):
    errors: list[BaseException] = []

    def writer(n: int) -> None:
        try:
            for i in range(40):
                with db.connection(label=f"w{n}") as conn:
                    set_setting(conn, f"w{n}.{i}", str(i))
        except BaseException as exc:  # noqa: BLE001
            errors.append(exc)

    def reader() -> None:
        try:
            for _ in range(80):
                with db.connection(mode="read") as conn:
                    conn.execute("SELECT COUNT(*) FROM settings").fetchone()
                    assert conn.execute("PRAGMA query_only").fetchone()[0] == 1
        except BaseException as exc:  # noqa: BLE001
            errors.append(exc)

    threads = [threading.Thread(target=writer, args=(n,)) for n in range(4)] + [threading.Thread(target=reader) for _ in range(4)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(60)
    assert not errors
    with db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM settings WHERE key LIKE 'w_.%'").fetchone()[0] == 160
    assert db.gate.state() == {"held": False, "waiting": 0}
    assert _idle(db) <= db_mod.POOL_IDLE_DURABLE
    stats = db_mod.pool_stats()
    assert stats["enabled"] is True and stats["reused"] > 0


def test_requests_reuse_connections_and_health_reports_it(settings):
    from fastapi.testclient import TestClient

    from smplwise.main import create_app

    app = create_app(settings)
    with TestClient(app) as client:
        client.get("/api/v1/settings")
        opened = db_mod.pool_stats()["opened"]
        for _ in range(5):
            assert client.get("/api/v1/settings").status_code == 200
        assert db_mod.pool_stats()["opened"] == opened  # five requests, no new connection
        body = client.get("/api/v1/health").json()
        assert body["db"]["write_lock"]["conn_pool"]["enabled"] is True
    assert _idle(app.state.db) == 0  # shutdown closed the idle connections


def test_db_conn_pool_is_an_addon_option_default_on_and_the_env_wins(tmp_path, monkeypatch, settings):
    from smplwise.config import load_settings
    from smplwise.main import create_app

    monkeypatch.delenv("SW_DB_CONN_POOL", raising=False)
    opts = tmp_path / "options.json"
    opts.write_text(json.dumps({"bootstrap_admin_username": "joni"}), encoding="utf-8")
    assert load_settings(opts).db_conn_pool is True
    opts.write_text(json.dumps({"db_conn_pool": False}), encoding="utf-8")
    assert load_settings(opts).db_conn_pool is False
    opts.write_text(json.dumps({"db_conn_pool": True}), encoding="utf-8")
    monkeypatch.setenv("SW_DB_CONN_POOL", "0")
    assert load_settings(opts).db_conn_pool is False
    create_app(settings)
    assert db_mod.CONN_POOL is False
    monkeypatch.delenv("SW_DB_CONN_POOL")
    create_app(settings)
    assert db_mod.CONN_POOL is True
    create_app(replace(settings, db_conn_pool=False))
    assert db_mod.CONN_POOL is False


def test_addon_config_declares_the_option():
    cfg = (Path(db_mod.__file__).resolve().parents[2] / "config.yaml").read_text(encoding="utf-8")
    assert "  db_conn_pool: true\n" in cfg and "  db_conn_pool: bool?\n" in cfg
