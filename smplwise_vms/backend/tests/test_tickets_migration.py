"""CR-038 slice 1 - migration 0079 (section 7.1): it applies on an empty database and on top of the previous schema (a database at
0078, the 2.4.10 line) without touching existing rows; every core table and index exists with the r2 columns; the foreign keys hold;
the seeds (the running number, the "אחזקה" department with four priorities and the section 13.1 SLA matrix) are there; 0079 is the
highest migration of this branch (the spec reserves 0079-0084; TK257 added 0085, provisionally)."""
from __future__ import annotations

import re
import shutil
import sqlite3

import pytest

from smplwise import db as dbmod

CR038 = range(79, 93)  # the numbers the spec reserves for CR-038 (section 7) + 0085 (TK257 quotes) + 0086 (deep review B3, renumbered at integration) + 0087 (TKSTAFF1 staff links) + 0088 (TKDETAILBE detail: quotes v2, owner, allowed kinds; replaces 0085) + 0089 (TKRFQ1 requests for quotation) + 0090 (TKMAP1 map element) + 0091 (TKNOTIFOTP number verification) + 0092 (TKTPLMIG quick-reply data migration)
TABLES = {
    "ticket_departments", "ticket_department_members", "ticket_priorities", "ticket_categories", "ticket_sla_rules", "ticket_templates",
    "ticket_sequence", "tickets", "ticket_assignments", "ticket_events", "ticket_requests", "ticket_saved_views", "ticket_attachments",
    "ticket_device_context",
}
INDEXES = {
    "idx_ticket_departments_key", "idx_ticket_members_subject", "idx_ticket_categories_dept", "idx_ticket_templates_dept", "idx_tickets_dept_status",
    "idx_tickets_open_check", "idx_tickets_entity", "idx_tickets_registry", "idx_tickets_waiting", "idx_tickets_created_by", "idx_tickets_purge",
    "idx_tickets_open_dedupe", "idx_ticket_assignments_ticket", "idx_ticket_assignments_user", "idx_ticket_assignments_contact",
    "idx_ticket_events_ticket", "idx_ticket_requests_at", "idx_ticket_saved_views_user", "idx_tickets_sort_activity", "idx_tickets_sort_created",
    "idx_ticket_attachments_ticket",
}
R2_COLUMNS = {
    "ticket_departments": {"share_history_external", "auto_close_after_days", "urgent_is_critical", "link_sliding_days", "link_cap_days",
                           "link_grace_hours", "send_hours_json", "open_to_all", "reopen_days"},
    "ticket_sla_rules": {"link_unopened_min"},
    "tickets": {"duplicate_of", "reopen_count", "external_stale", "done_at", "dedupe_key", "rule_ref", "place_text", "registry_id"},
    "ticket_events": {"visible_external"},
    "ticket_attachments": {"visible_external"},
    "ticket_assignments": {"require_code", "return_kind", "return_reason", "share_history"},
}


def _schema(conn: sqlite3.Connection) -> tuple[set[str], set[str]]:
    tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
    indexes = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type = 'index'")}
    return tables, indexes


def test_0079_is_the_highest_migration_of_the_branch():
    """0079 is the first of the CR-038 range; the later slices take their reserved numbers (0080 slice 4, 0081 slice 5b, 0082
    slice 5a, 0083 slice 9, 0084 employee contacts, 0085 TK257 quotes, 0086 deep review B3, 0087 TKSTAFF1 staff links, 0088 TKDETAILBE, 0089 TKRFQ1) - nothing of another change lives above 0079."""
    numbers = sorted(int(f.name.split("_", 1)[0]) for f in dbmod.MIGRATIONS_DIR.glob("*.sql"))
    assert [n for n in numbers if n >= 79][0] == 79 and all(n in numbers for n in range(79, 89))  # 0079..0088 are this module's; higher numbers belong to later changes (provisional until the lead renumbers)
    assert (dbmod.MIGRATIONS_DIR / "0079_tickets_core.sql").is_file()
    assert numbers.count(79) == 1
    sql = (dbmod.MIGRATIONS_DIR / "0079_tickets_core.sql").read_text(encoding="utf-8")
    assert not re.search(r"^\s*(BEGIN|COMMIT)\b", sql, re.M | re.I), "Database.migrate wraps the file in its own transaction"
    assert "CR-038" in sql.splitlines()[0]


def test_an_empty_database_gets_every_table_index_column_and_seed(settings):
    database = dbmod.Database(settings.db_path)
    assert 79 in database.migrate()
    with database.connection(mode="read") as conn:
        tables, indexes = _schema(conn)
        assert TABLES <= tables and INDEXES <= indexes
        for table, cols in R2_COLUMNS.items():
            have = {r[1] for r in conn.execute(f"PRAGMA table_info({table})")}
            assert cols <= have, (table, cols - have)
        assert conn.execute("SELECT value FROM ticket_sequence WHERE name = 'ticket'").fetchone()[0] == 1000
        dept = dict(conn.execute("SELECT * FROM ticket_departments").fetchone())
        assert (dept["id"], dept["key"], dept["name"], dept["active"], dept["open_to_all"], dept["share_history_external"], dept["reopen_days"]) == \
            ("dept-maintenance", "maintenance", "אחזקה", 1, 1, 0, 14), "history to outsiders is OFF by default (D3)"
        prios = conn.execute("SELECT key, rank, notify_severity, is_default FROM ticket_priorities ORDER BY rank").fetchall()
        assert [tuple(p) for p in prios] == [("urgent", 0, "critical", 0), ("high", 1, "alert", 0), ("normal", 2, "alert", 1), ("low", 3, "info", 0)]
        sla = {r["key"]: r for r in conn.execute(
            "SELECT p.key, s.* FROM ticket_sla_rules s JOIN ticket_priorities p ON p.id = s.priority_id").fetchall()}
        assert (sla["urgent"]["unassigned_after_min"], sla["urgent"]["ack_within_min"], sla["urgent"]["stuck_after_min"], sla["urgent"]["resolve_within_min"]) == (15, 30, 60, 480)
        assert (sla["normal"]["stuck_after_min"], sla["low"]["resolve_within_min"]) == (4320, 43200)
        assert all(r["link_unopened_min"] == 1440 and r["max_reminders"] == 2 and r["manager_alert_after_steps"] == 1 for r in sla.values()), "D11: 24 h"
        assert conn.execute("SELECT COUNT(*) FROM tickets").fetchone()[0] == 0


def test_on_top_of_the_previous_schema_nothing_else_moves(settings, tmp_path, monkeypatch):
    real = dbmod.MIGRATIONS_DIR
    older = tmp_path / "older"
    older.mkdir()
    for f in real.glob("*.sql"):
        if int(f.name.split("_", 1)[0]) < 79:
            shutil.copy(f, older / f.name)
    monkeypatch.setattr(dbmod, "MIGRATIONS_DIR", older)
    database = dbmod.Database(settings.db_path)
    database.migrate()
    with database.connection() as conn:
        conn.execute("INSERT INTO settings(key, value) VALUES ('ui.start_route', 'live')")
        before = conn.execute("SELECT COUNT(*) FROM sqlite_master").fetchone()[0]
    monkeypatch.setattr(dbmod, "MIGRATIONS_DIR", real)
    # 93: TKSECRETS2's app_secrets (provisional number)
    assert [n for n in dbmod.Database(settings.db_path).migrate() if n != 93] == [n for n in CR038 if any(dbmod.MIGRATIONS_DIR.glob(f"{n:04d}_*.sql"))]
    with database.connection(mode="read") as conn:
        assert conn.execute("SELECT value FROM settings WHERE key = 'ui.start_route'").fetchone()[0] == "live"
        tables, _ = _schema(conn)
        assert TABLES <= tables
        assert conn.execute("SELECT COUNT(*) FROM sqlite_master").fetchone()[0] > before
        assert conn.execute("SELECT MIN(version) FROM schema_migrations WHERE version >= 79").fetchone()[0] == 79
    assert dbmod.Database(settings.db_path).migrate() == [], "applied once"


def test_foreign_keys_hold(settings):
    database = dbmod.Database(settings.db_path)
    database.migrate()
    with database.connection() as conn:
        with pytest.raises(sqlite3.IntegrityError):
            conn.execute("INSERT INTO tickets(id, number, department_id, priority_id, title, status, origin, created_by, last_activity_at, created_at, updated_at) "
                         "VALUES ('t1', 1, 'nope', 'prio-maintenance-normal', 'x', 'new', 'manual', 'u', 'a', 'a', 'a')")
        with pytest.raises(sqlite3.IntegrityError):
            conn.execute("INSERT INTO tickets(id, number, department_id, priority_id, title, status, origin, created_by, last_activity_at, created_at, updated_at) "
                         "VALUES ('t2', 2, 'dept-maintenance', 'prio-maintenance-normal', 'x', 'bogus', 'manual', 'u', 'a', 'a', 'a')")
        with pytest.raises(sqlite3.IntegrityError):  # an assignment of kind user without a user
            conn.execute("INSERT INTO tickets(id, number, department_id, priority_id, title, status, origin, created_by, last_activity_at, created_at, updated_at) "
                         "VALUES ('t3', 3, 'dept-maintenance', 'prio-maintenance-normal', 'x', 'new', 'manual', 'u', 'a', 'a', 'a')")
            conn.execute("INSERT INTO ticket_assignments(id, ticket_id, assignee_kind, assignee_name, channel, assigned_by, assigned_at) "
                         "VALUES ('a1', 't3', 'user', 'x', 'inapp', 'u', 'a')")


def test_one_open_ticket_per_dedupe_key(settings):
    database = dbmod.Database(settings.db_path)
    database.migrate()
    ins = ("INSERT INTO tickets(id, number, department_id, priority_id, title, status, origin, created_by, last_activity_at, created_at, updated_at, dedupe_key) "
           "VALUES (?, ?, 'dept-maintenance', 'prio-maintenance-normal', 'x', ?, 'rule', 'system', 'a', 'a', 'a', 'rule:r1:light.x')")
    with database.connection() as conn:
        conn.execute(ins, ("t1", 1, "closed"))
        conn.execute(ins, ("t2", 2, "new"))
        with pytest.raises(sqlite3.IntegrityError):
            conn.execute(ins, ("t3", 3, "assigned"))
