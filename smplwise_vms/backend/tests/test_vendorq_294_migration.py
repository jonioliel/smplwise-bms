"""CR-VENDORQ-294 (docs/changes/CR-VENDORQ-294-DESIGN.md section 2): migration 0128 (built as PROVISIONAL 0129) on the real migration files.

A database at 0123 (2.9.1 main) is filled with every shape both rebuilt tables hold - outbox rows of every state, with the 0086
`link_generation`, the 0089 `rfq_id`, nonces and idempotency keys; RFQ thread lines of both directions, the 0104 question columns and the
D21 reminder lines (`author_kind 'user'`, `author_id 'system'`) - then the later migrations up to 0128 run. Every row and column survives, only the D21 rows change
(to `author_kind 'system'`), the indexes come back by name, the new CHECKs hold, the foreign keys and the file are intact, and the
documented rollback SQL restores the pre-0128 data shape. Every name and text is invented."""
from __future__ import annotations

import re
import shutil
import sqlite3

import pytest

from smplwise import db as dbmod

AT = "2026-10-01T08:00:00Z"
BASE = 123  # origin/main at the branch point (2.9.1)
NUMBER = 128  # final (built as PROVISIONAL 0129; renumbered at integ/2100)
DESIGN = dbmod.MIGRATIONS_DIR.parents[3] / "docs" / "changes" / "CR-VENDORQ-294-DESIGN.md"


def _file():
    files = [f for f in dbmod.MIGRATIONS_DIR.glob("*.sql") if int(f.name.split("_", 1)[0]) == NUMBER]
    assert len(files) == 1, "exactly one 0128 file"
    return files[0]


def _at_base(settings, tmp_path, monkeypatch) -> dbmod.Database:
    real = dbmod.MIGRATIONS_DIR
    older = tmp_path / "at-base"
    older.mkdir()
    for f in real.glob("*.sql"):
        if int(f.name.split("_", 1)[0]) <= BASE:
            shutil.copy(f, older / f.name)
    monkeypatch.setattr(dbmod, "MIGRATIONS_DIR", older)
    database = dbmod.Database(settings.db_path)
    assert database.migrate()[-1] == BASE
    monkeypatch.setattr(dbmod, "MIGRATIONS_DIR", real)
    return database


def _outbox(conn, oid, purpose, state, **extra):
    row = {"id": oid, "recipient_kind": "contact", "contact_id": "c1", "channel": "whatsapp", "purpose": purpose, "use_key": "tickets.messages",
           "params_json": '{"name":"Dana"}', "state": state, "not_before": AT, "created_at": AT, "updated_at": AT, **extra}
    cols = ", ".join(row)
    conn.execute(f"INSERT INTO ticket_outbox({cols}) VALUES ({', '.join('?' * len(row))})", tuple(row.values()))


def _world(conn):
    conn.execute("INSERT INTO ticket_departments(id, key, name, created_at, updated_at) VALUES ('d1', 'maint', 'Maintenance', ?, ?)", (AT, AT))
    conn.execute("INSERT INTO ticket_contacts(id, kind, display_name, created_by, created_at, updated_at) VALUES ('c1', 'person', 'Dana Example', 'u', ?, ?)", (AT, AT))
    conn.execute("INSERT INTO ticket_rfqs(id, number, department_id, title, allowed_line_kinds, due_at, state, created_by, created_at, updated_at) "
                 "VALUES ('r1', 1, 'd1', 'Pump', '[\"labor\"]', ?, 'sent', 'u1', ?, ?)", (AT, AT, AT))
    conn.execute("INSERT INTO ticket_rfq_vendors(id, rfq_id, contact_id, channel, state, invited_at, created_by, created_at, updated_at) "
                 "VALUES ('v1', 'r1', 'c1', 'whatsapp', 'sent', ?, 'u1', ?, ?)", (AT, AT, AT))
    msgs = [
        {"id": "m-out", "direction": "out", "body": "Clarification", "author_kind": "user", "author_id": "u1", "source_kind": "clarify", "notified": 1,
         "outbox_id": "o-sent", "broadcast_id": "b1"},
        {"id": "m-in", "direction": "in", "body": "Question?", "author_kind": "contact", "author_id": "c1", "quote_id": "q1", "read_at": AT,
         "read_by": "u1", "answered_at": AT, "answered_by": "u1", "answer_id": "m-ans", "reminded_at": AT},
        {"id": "m-ans", "direction": "out", "body": "Answer", "author_kind": "user", "author_id": "u1", "answers_id": "m-in"},
        {"id": "m-sys", "direction": "out", "body": "Reminder: please confirm", "author_kind": "user", "author_id": "system", "source_kind": "award",
         "source_id": "aw1", "notified": 1, "outbox_id": "o-rfq"},
    ]
    for m in msgs:
        row = {"rfq_id": "r1", "rfq_vendor_id": "v1", "created_at": AT, **m}
        conn.execute(f"INSERT INTO ticket_rfq_messages({', '.join(row)}) VALUES ({', '.join('?' * len(row))})", tuple(row.values()))
    _outbox(conn, "o-sent", "assign", "sent", link_generation=2, idempotency_key="k-sent", reply_nonce="nonce-1", sent_at=AT,
            provider_message_id="mid-1", account_key="entry:A")
    _outbox(conn, "o-held", "reminder", "held", held_reason="send_hours", held_since=AT, link_generation=1)
    _outbox(conn, "o-code", "phone_verify", "queued", code_id="pv1", priority=0)
    _outbox(conn, "o-rfq", "rfq_update", "unknown", rfq_id="r1", outcome_code="timeout", attempts=1, first_attempt_at=AT)
    _outbox(conn, "o-test", "test", "not_sent", recipient_kind="test", contact_id=None, outcome_code="target_lost")


def _dump(conn, table):
    return {r["id"]: dict(r) for r in conn.execute(f"SELECT * FROM {table}")}


def _indexes(conn, table):
    return {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = ? AND name NOT LIKE 'sqlite_%'", (table,))}


@pytest.fixture
def upgraded(settings, tmp_path, monkeypatch):
    database = _at_base(settings, tmp_path, monkeypatch)
    with database.connection() as conn:
        _world(conn)
        before = {t: _dump(conn, t) for t in ("ticket_outbox", "ticket_rfq_messages")}
        idx = {t: _indexes(conn, t) for t in ("ticket_outbox", "ticket_rfq_messages")}
    applied = dbmod.Database(settings.db_path).migrate()
    return database, before, idx, applied


def test_the_file_carries_its_final_number_and_rebuilds_each_table_once():
    f = _file()
    assert "PROVISIONAL" not in f.name and "Final number 0128" in f.read_text(encoding="utf-8").splitlines()[0]
    sql = f.read_text(encoding="utf-8")
    assert sql.count("CREATE TABLE ticket_outbox_new") == 1 and sql.count("CREATE TABLE ticket_rfq_messages_new") == 1
    assert "CREATE TABLE outbound_documents" in sql
    later = [g.name for g in dbmod.MIGRATIONS_DIR.glob("*.sql") if BASE < int(g.name[:4]) and g != f
             and re.search(r"CREATE TABLE (ticket_outbox_new|ticket_rfq_messages_new)", g.read_text(encoding="utf-8"))]
    # release/2160: 0170 (CR-INTAKE99) rebuilds ticket_outbox once more for its `intake_reply` purpose - a later release's own rebuild
    assert later == ["0170_ticket_intake.sql"], "one rebuild of each table on this branch; the next one is CR-INTAKE99's"


def test_every_row_and_column_survives_and_only_the_d21_lines_change(upgraded):
    database, before, idx, applied = upgraded
    assert NUMBER in applied and dbmod.Database(database.path).migrate() == [], "runs once"
    with database.connection(mode="read") as conn:
        after = {t: _dump(conn, t) for t in ("ticket_outbox", "ticket_rfq_messages")}
        assert set(after["ticket_outbox"]) == set(before["ticket_outbox"])
        for oid, row in before["ticket_outbox"].items():
            got = after["ticket_outbox"][oid]
            assert {k: got[k] for k in row} == row, oid
            assert (got["source_module"], got["source_id"], got["document_id"]) == (None, None, None)
        assert set(after["ticket_rfq_messages"]) == set(before["ticket_rfq_messages"])
        for mid, row in before["ticket_rfq_messages"].items():
            got = after["ticket_rfq_messages"][mid]
            want = dict(row, author_kind="system") if mid == "m-sys" else row
            assert got == want, mid
        assert _indexes(conn, "ticket_outbox") == idx["ticket_outbox"] | {"idx_ticket_outbox_source"}
        assert _indexes(conn, "ticket_rfq_messages") == idx["ticket_rfq_messages"]
        assert conn.execute("PRAGMA foreign_key_check").fetchall() == []
        assert conn.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
        fks = {(r["table"], r["from"], r["on_delete"]) for r in conn.execute("PRAGMA foreign_key_list(ticket_rfq_messages)")}
        assert fks == {("ticket_rfqs", "rfq_id", "CASCADE"), ("ticket_rfq_vendors", "rfq_vendor_id", "CASCADE")}
        assert {r[1] for r in conn.execute("PRAGMA table_info(outbound_documents)")} >= {
            "id", "key_id", "token_hash", "module", "source_id", "recipient_kind", "recipient_id", "media_type", "filename", "size_bytes",
            "sha256", "content", "max_opens", "open_count", "expires_at", "revoked_at", "revoked_reason", "purged_at"}


def test_the_new_checks_hold(upgraded):
    database = upgraded[0]
    with database.connection() as conn:
        _outbox(conn, "o-rep", "report", "queued", source_module="temperature", source_id="s1", document_id="doc1")
        for bad in ({"purpose": "report"}, {"purpose": "assign", "source_module": "temperature", "source_id": "s2"},
                    {"purpose": "bogus"}, {"purpose": "report", "source_module": "Temperature!", "source_id": "s3"}):
            with pytest.raises(sqlite3.IntegrityError):
                _outbox(conn, "o-bad", bad.pop("purpose"), "queued", **bad)
        conn.execute("INSERT INTO ticket_rfq_messages(id, rfq_id, rfq_vendor_id, direction, body, author_kind, author_id, created_at) "
                     "VALUES ('m-new', 'r1', 'v1', 'out', 'Auto', 'system', 'system', ?)", (AT,))
        with pytest.raises(sqlite3.IntegrityError):
            conn.execute("INSERT INTO ticket_rfq_messages(id, rfq_id, rfq_vendor_id, direction, body, author_kind, author_id, created_at) "
                         "VALUES ('m-bad', 'r1', 'v1', 'in', 'x', 'system', 'system', ?)", (AT,))
        with pytest.raises(sqlite3.IntegrityError):
            conn.execute("INSERT INTO outbound_documents(id, key_id, token_hash, module, recipient_kind, recipient_id, media_type, filename, "
                         "size_bytes, sha256, content, max_opens, created_at, expires_at) VALUES ('x', 'k', 'h', 'temperature', 'contact', 'c1', "
                         "'text/html', 'r.html', ?, 's', x'00', 5, ?, '2026-10-02T08:00:00Z')", (3 * 1024 * 1024, AT))
        conn.execute("DELETE FROM ticket_rfqs WHERE id = 'r1'")
        assert conn.execute("SELECT COUNT(*) FROM ticket_rfq_messages").fetchone()[0] == 0, "the cascade is kept"


def _rollback_sql() -> str:
    text = DESIGN.read_text(encoding="utf-8")
    section = text.split("## 3. Rollback", 1)[1]
    return section.split("```sql", 1)[1].split("```", 1)[0]


def test_the_documented_rollback_restores_the_pre_0128_data_shape(upgraded):
    database = upgraded[0]
    with database.connection() as conn:
        _outbox(conn, "o-rep", "report", "queued", source_module="temperature", source_id="s1")
        _outbox(conn, "o-rep-sent", "report", "sent", source_module="temperature", source_id="s2")
    raw = sqlite3.connect(database.path)
    try:
        raw.executescript(_rollback_sql())
        raw.row_factory = sqlite3.Row
        assert raw.execute("SELECT COUNT(*) FROM ticket_rfq_messages WHERE author_kind = 'system'").fetchone()[0] == 0
        assert dict(raw.execute("SELECT author_kind, author_id FROM ticket_rfq_messages WHERE id = 'm-sys'").fetchone()) == {
            "author_kind": "user", "author_id": "system"}
        states = {r["id"]: (r["state"], r["outcome_code"]) for r in raw.execute("SELECT id, state, outcome_code FROM ticket_outbox WHERE purpose = 'report'")}
        assert states == {"o-rep": ("cancelled", "rollback"), "o-rep-sent": ("sent", None)}
    finally:
        raw.close()
