"""Read-mode request connections: the busy GET paths run deferred and query-only, so they never wait for the single
write lock; a refusal on such a request is still audited (through a side transaction); the per-request user touch
is throttled to once a minute; the bootstrap grant still lands on a read-mode first request; and a read-mode
request runs while a writer holds the lock."""
from __future__ import annotations

import sqlite3
import threading
import time
from dataclasses import replace

from conftest import as_user, bind, seed_tree
from fastapi.testclient import TestClient

from smplwise.db import Database, read_mode, unlocked
from smplwise.main import create_app


def test_read_connection_is_query_only_and_unlocked_restarts_deferred(settings):
    app = create_app(settings)
    db: Database = app.state.db
    with db.connection(mode="read") as conn:
        assert read_mode(conn) and conn.in_transaction
        assert conn.execute("SELECT COUNT(*) FROM settings").fetchone()[0] >= 0
        try:
            conn.execute("INSERT INTO settings(key, value) VALUES ('x', 'y')")
            assert False, "a read-mode connection must not write"
        except sqlite3.OperationalError as exc:
            assert "readonly" in str(exc)
        with unlocked(conn):
            assert not conn.in_transaction
        assert conn.in_transaction, "unlocked() restarts a deferred transaction in read mode"
        with db.write_aside() as w:
            w.execute("INSERT INTO settings(key, value) VALUES ('aside', '1')")
    with db.connection() as conn:
        assert not read_mode(conn)
        assert conn.execute("SELECT value FROM settings WHERE key = 'aside'").fetchone()[0] == "1"


def test_refusal_on_a_read_request_is_audited_and_touch_is_throttled(settings):
    app = create_app(settings)
    c = TestClient(app)
    seed_tree(c)
    bind(c, settings, "ron", "viewer", "installation", "*")
    assert c.get("/api/v1/storage", headers=as_user("ron")).status_code == 403
    assert c.get("/api/v1/me", headers=as_user("ron")).status_code == 200
    assert c.get("/api/v1/me", headers=as_user("ron")).status_code == 200
    with app.state.db.connection() as conn:
        denied = conn.execute("SELECT COUNT(*) FROM audit_log WHERE decision = 'denied' AND actor_username = 'ron' AND action = 'system.configure'").fetchone()[0]
        seen = conn.execute("SELECT last_seen_at FROM users WHERE id = 'dev-ron'").fetchone()[0]
    assert denied == 1, "the refusal on a read-mode request is kept"
    assert seen, "the user row exists after the first sight"
    time.sleep(1.1)
    assert c.get("/api/v1/me", headers=as_user("ron")).status_code == 200
    with app.state.db.connection() as conn:
        seen2 = conn.execute("SELECT last_seen_at FROM users WHERE id = 'dev-ron'").fetchone()[0]
    assert seen2 == seen, "within a minute the user row is not rewritten on every request"
    app.state.db.touched.clear()
    time.sleep(1.1)
    assert c.get("/api/v1/me", headers=as_user("ron")).status_code == 200
    with app.state.db.connection() as conn:
        seen3 = conn.execute("SELECT last_seen_at FROM users WHERE id = 'dev-ron'").fetchone()[0]
    assert seen3 >= seen, "once the throttle window passed the touch is written again"


def test_bootstrap_grant_lands_on_a_read_mode_first_request(settings, tmp_path):
    s = replace(settings, dev_user="boss", bootstrap_admin_username="boss", data_dir=tmp_path / "boot")
    app = create_app(s)
    c = TestClient(app)
    me = c.get("/api/v1/me")
    assert me.status_code == 200 and any(b["role_id"] == "system_admin" for b in me.json()["bindings"])
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT value FROM settings WHERE key = 'bootstrap_state'").fetchone()[0].startswith("done:")
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'rbac.bootstrap_admin'").fetchone()[0] == 1


def test_reads_do_not_wait_for_a_writer(settings):
    app = create_app(settings)
    c = TestClient(app)
    seed_tree(c)
    db: Database = app.state.db
    held = threading.Event()
    release = threading.Event()

    def writer():
        with db.connection() as conn:  # BEGIN IMMEDIATE: holds the write lock until released
            conn.execute("INSERT INTO settings(key, value) VALUES ('hold', '1')")
            held.set()
            release.wait(10)

    t = threading.Thread(target=writer, daemon=True)
    t.start()
    assert held.wait(5)
    try:
        started = time.time()
        r = c.get("/api/v1/events?limit=5")
        elapsed = time.time() - started
        assert r.status_code == 200, r.text
        assert elapsed < 2.0, f"a read-mode request waited {elapsed:.1f} s for the writer"
        started = time.time()
        assert c.get("/api/v1/cameras").status_code == 200 and c.get("/api/v1/health/summary").status_code == 200
        assert time.time() - started < 2.0
    finally:
        release.set()
        t.join(5)
