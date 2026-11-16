"""CR-AUDIT-INDEX-2436 (code review 05:P1-04, 05:P2-12, 01:F-09): the hot lookups below were full table scans on the migrated
schema. Migration 0216 adds one index each; these `EXPLAIN QUERY PLAN` assertions keep them from going back to `SCAN`.

The SQL strings are the ones the services run (copied, not imported - a query that changes shape should be re-checked here)."""
from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest

from smplwise import db as dbmod

MIG = dbmod.MIGRATIONS_DIR / "0216_review_indexes.sql"


@pytest.fixture()
def conn(settings) -> sqlite3.Connection:
    database = dbmod.Database(settings.db_path)
    database.migrate()
    c = sqlite3.connect(settings.db_path)
    yield c
    c.close()


def _plan(conn: sqlite3.Connection, sql: str, params: tuple) -> list[str]:
    return [r[3] for r in conn.execute("EXPLAIN QUERY PLAN " + sql, params).fetchall()]


def _uses(conn: sqlite3.Connection, sql: str, params: tuple, table: str, index: str) -> None:
    plan = _plan(conn, sql, params)
    assert not any(p.startswith(f"SCAN {table}") and "INDEX" not in p for p in plan), f"full scan of {table}: {plan}"
    assert any(index in p for p in plan), f"expected {index}: {plan}"


# ------------------------------------------------------------------------------------------------ audit_log by action (05:P1-04)

@pytest.mark.parametrize("sql, params", [
    # services/media_commands.py (the window rows of media.keys / media.rate_limited)
    ("SELECT MAX(id) FROM audit_log WHERE action = 'media.keys' AND actor_user_id = ? AND resource_id = ?", ("u", "k")),
    # services/capture_lease.py:498
    ("SELECT 1 FROM audit_log WHERE action = ? AND resource_id = ? LIMIT 1", ("a", "r")),
    # routers/anchors.py:363
    ("SELECT 1 FROM audit_log WHERE action = 'history.presence.view' AND actor_user_id = ? AND resource_id = ? AND substr(at, 1, 10) = ? LIMIT 1",
     ("u", "r", "2026-11-13")),
    # services/access_external.py:498
    ("SELECT resource_id, at FROM audit_log WHERE action = ? AND decision = 'allowed' AND at >= ? AND at < ?", ("a", "s", "e")),
    # services/wiskey_auto_install.py:756
    ("SELECT reason, details_json FROM audit_log WHERE action = ? ORDER BY rowid DESC LIMIT 1", ("a",)),
])
def test_audit_by_action_uses_the_action_index(conn, sql, params):
    _uses(conn, sql, params, "audit_log", "idx_audit_action_at")


# ------------------------------------------------------------------------------------------------ nvr_changes by batch (05:P2-12)

@pytest.mark.parametrize("sql, params", [
    ("UPDATE nvr_changes SET status = 'not_attempted', error = ? WHERE batch_id = ? AND status = 'queued'", ("why", "b")),
    ("SELECT status, error, COUNT(*) AS n FROM nvr_changes WHERE batch_id = ? GROUP BY status, error", ("b",)),
    ("SELECT * FROM nvr_changes WHERE batch_id = ? ORDER BY batch_index LIMIT ? OFFSET ?", ("b", 50, 0)),
    ("SELECT * FROM nvr_changes WHERE batch_id = ? AND status = 'queued' ORDER BY batch_index LIMIT 1", ("b",)),
    ("SELECT COUNT(*) FROM nvr_changes WHERE batch_id = ? AND reboot_required = 1", ("b",)),
])
def test_nvr_changes_by_batch_uses_the_batch_index(conn, sql, params):
    _uses(conn, sql, params, "nvr_changes", "idx_nvr_changes_batch")


# ------------------------------------------------------------------------------------------------ notifications (05:P2-12, 01:F-09)

@pytest.mark.parametrize("sql, params", [
    # services/notify_sources.py:219 and the other monitors
    ("SELECT dedupe_key, subject_kind, subject_id, last_at FROM notifications WHERE source = ? AND state != 'resolved'", ("s",)),
    ("SELECT 1 FROM notifications WHERE source = 'nvr.offline' AND state != 'resolved' LIMIT 1", ()),
])
def test_notifications_by_source_use_the_source_index(conn, sql, params):
    _uses(conn, sql, params, "notifications", "idx_notifications_source")


def test_notification_key_seen_uses_the_dedupe_index(conn):
    """services/tickets/store_dash_extra.py `notification_key_seen`: any state, so the partial unique index (open rows) cannot serve it."""
    _uses(conn, "SELECT 1 FROM notifications WHERE dedupe_key = ? LIMIT 1", ("k",), "notifications", "idx_notifications_dedupe")


# ------------------------------------------------------------------------------------------------ ticket_visits by assignment (01:F-09)

@pytest.mark.parametrize("sql, params", [
    # services/tickets/store_visits.py `latest_for_assignment`, `latest_missed`
    ("SELECT * FROM ticket_visits WHERE assignment_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1", ("a",)),
    ("SELECT * FROM ticket_visits WHERE assignment_id = ? AND state = 'missed' AND rescheduled_to IS NULL AND id != ? "
     "ORDER BY planned_to DESC, rowid DESC LIMIT 1", ("a", "v")),
])
def test_visits_by_assignment_use_the_assignment_index(conn, sql, params):
    _uses(conn, sql, params, "ticket_visits", "idx_ticket_visits_assignment")


# ------------------------------------------------------------------------------------------------ the migration itself


def test_0216_is_idempotent_and_changes_no_rows(conn):
    """Every statement is CREATE INDEX IF NOT EXISTS: running the file again on a migrated database is a no-op."""
    sql = MIG.read_text(encoding="utf-8")
    code = "\n".join(line for line in sql.splitlines() if not line.lstrip().startswith("--"))
    stmts = [" ".join(s.split()).upper() for s in code.split(";") if s.strip()]
    assert len(stmts) == 5 and all(s.startswith("CREATE INDEX IF NOT EXISTS ") for s in stmts), stmts
    before = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type = 'index'")}
    conn.executescript(sql)
    conn.executescript(sql)
    after = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type = 'index'")}
    assert before == after
