"""WARMUP-POLISH-2421: the bounded, read-only start-up warm-up (services/startup_warmup.py) and its switch."""

from __future__ import annotations

import sqlite3

import pytest

from smplwise.services import startup_warmup as wu


def test_run_reads_every_step_and_reports_its_time(client):
    out = wu.run(client.app.state.db, pause_s=0)
    for name, _fn in wu.STEPS:
        assert isinstance(out[name], float), out  # a time in ms: the step ran and did not fail
    assert out["total_ms"] >= 0


def test_the_routes_are_matched_without_calling_anything(client):
    """The route warm-up only matches a bare scope (no handler runs, no response is sent): no audit row, no setting changes."""
    db = client.app.state.db
    with db.connection(mode="read") as conn:
        before = conn.execute("SELECT COUNT(*) FROM audit_log").fetchone()[0]
    out = wu.run(db, app=client.app, pause_s=0)
    assert out["routes"] > 100 and isinstance(out["routes_ms"], float)
    with db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log").fetchone()[0] == before
    assert client.get("/api/v1/settings").status_code == 200  # the app answers as before


def test_every_step_runs_on_a_read_only_connection(client):
    """A write inside a step is refused by SQLite (query_only): the warm-up can never change the database."""

    def writer(conn):
        conn.execute("CREATE TABLE warmup_probe (x)")

    out = wu.run(client.app.state.db, pause_s=0, steps=[("writer", writer)])
    assert out["writer"].startswith("failed: ")
    with client.app.state.db.connection(mode="read") as conn:
        with pytest.raises(sqlite3.OperationalError):
            conn.execute("SELECT * FROM warmup_probe").fetchall()


def test_a_failing_step_never_stops_the_next(client):
    seen = []

    def boom(_conn):
        raise RuntimeError("x")

    out = wu.run(client.app.state.db, pause_s=0, steps=[("boom", boom), ("after", lambda _c: seen.append(1))])
    assert out["boom"] == "failed: RuntimeError" and isinstance(out["after"], float) and seen == [1]


def test_the_budget_skips_the_remaining_steps(client):
    ticks = iter([0.0, 0.0, 0.0, 31.0, 31.0, 31.0, 31.0])
    out = wu.run(client.app.state.db, pause_s=0, steps=[("a", lambda _c: None), ("b", lambda _c: None)], clock=lambda: next(ticks))
    assert isinstance(out["a"], float) and out["b"] == "skipped: budget"


@pytest.mark.parametrize(("env", "stored", "want"), [(None, None, True), (None, "false", False), (None, "true", True), ("0", None, False), ("1", "false", True), ("off", "true", False)])
def test_the_switch_setting_and_environment(client, monkeypatch, env, stored, want):
    if env is None:
        monkeypatch.delenv(wu.ENV, raising=False)
    else:
        monkeypatch.setenv(wu.ENV, env)
    if stored is not None:
        assert client.patch("/api/v1/settings", json={wu.SETTING: stored}).status_code == 200
    assert wu.enabled(client.app.state.db) is want


def test_setting_default_and_validation(client):
    from smplwise.routers.settings import DEFAULTS

    assert DEFAULTS[wu.SETTING] == "true"
    assert client.get("/api/v1/settings").json()["settings"][wu.SETTING] == "true"
    assert client.patch("/api/v1/settings", json={wu.SETTING: "maybe"}).status_code == 422


def test_start_returns_no_thread_while_the_environment_switch_is_off(client, monkeypatch):
    monkeypatch.setenv(wu.ENV, "0")
    assert wu.start(client.app.state.db, delay_s=0) is None


def test_start_runs_in_a_daemon_thread(client, monkeypatch):
    monkeypatch.setenv(wu.ENV, "1")
    monkeypatch.setattr(wu, "PAUSE_S", 0)
    t = wu.start(client.app.state.db, delay_s=0)
    assert t is not None and t.daemon
    t.join(timeout=30)
    assert not t.is_alive()
