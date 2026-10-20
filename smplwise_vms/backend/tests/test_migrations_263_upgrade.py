"""Integration 2.6.3 (integ/263): the upgrade from a populated 2.5.8 database (migrations up to 0087) to 0093.

Proves on the real migration files: 0088..0093 run once each, in order, with no gap; every ticket_outbox row (with its 0086
link_generation) survives the ONE rebuild of the release (0089, which also carries TKNOTIFOTP's `phone_verify` purpose); exactly one
migration of the release rebuilds ticket_outbox; the quick-reply data migration (0092) rewrites a saved template once and running its
statement again changes nothing; 0091 marks numbers confirmed before it as confirmed by their user. Every name and text is invented."""
from __future__ import annotations

import shutil
import sqlite3

import pytest

from smplwise import db as dbmod

AT = "2026-10-01T08:00:00Z"
OLD_HE = "לאישור מהיר השב 1 = התקבל, 2 = בטיפול"
NEW_HE = "חובה להיכנס לקישור כדי להמשיך בטיפול."
RELEASE = [88, 89, 90, 91, 92, 93]


def _numbers() -> list[int]:
    return sorted(int(f.name.split("_", 1)[0]) for f in dbmod.MIGRATIONS_DIR.glob("*.sql"))


def _at_258(settings, tmp_path, monkeypatch) -> dbmod.Database:
    real = dbmod.MIGRATIONS_DIR
    older = tmp_path / "at-258"
    older.mkdir()
    for f in real.glob("*.sql"):
        if int(f.name.split("_", 1)[0]) <= 87:
            shutil.copy(f, older / f.name)
    monkeypatch.setattr(dbmod, "MIGRATIONS_DIR", older)
    database = dbmod.Database(settings.db_path)
    assert database.migrate()[-1] == 87
    monkeypatch.setattr(dbmod, "MIGRATIONS_DIR", real)
    return database


def _outbox(conn, oid, purpose, state, *, gen=None, key=None):
    conn.execute("INSERT INTO ticket_outbox(id, recipient_kind, contact_id, channel, purpose, use_key, params_json, state, not_before, "
                 "idempotency_key, link_generation, reply_nonce, created_at, updated_at) VALUES (?, 'contact', 'c1', 'whatsapp', ?, "
                 "'tickets.messages', '{\"n\":1}', ?, ?, ?, ?, ?, ?, ?)", (oid, purpose, state, AT, key, gen, f"nonce-{oid}", AT, AT))


def test_the_release_numbers_are_contiguous_and_final():
    numbers = _numbers()
    assert numbers == list(range(1, numbers[-1] + 1)), "release_check requires a contiguous sequence"
    assert all(n in numbers for n in RELEASE)
    names = {int(f.name[:4]): f.name for f in dbmod.MIGRATIONS_DIR.glob("*.sql")}
    assert [names[n] for n in RELEASE] == ["0088_ticket_detail.sql", "0089_ticket_rfq.sql", "0090_ticket_map_element.sql",
                                           "0091_ticket_phone_verify.sql", "0092_ticket_template_quick_reply.sql", "0093_app_secrets.sql"]
    rebuilds = [f.name for f in dbmod.MIGRATIONS_DIR.glob("*.sql")
                if int(f.name[:4]) in RELEASE and "CREATE TABLE ticket_outbox_new" in f.read_text(encoding="utf-8")]
    # integ/2100: scoped to this release's files - a later release may rebuild ticket_outbox again (0128 CR-VENDORQ-294 does)
    assert rebuilds == ["0089_ticket_rfq.sql"], "exactly one ticket_outbox rebuild in the release"


def test_a_populated_258_database_upgrades_to_0093(settings, tmp_path, monkeypatch):
    database = _at_258(settings, tmp_path, monkeypatch)
    with database.connection() as conn:
        _outbox(conn, "o-sent", "assign", "sent", gen=2, key="k-sent")
        _outbox(conn, "o-queued", "reminder", "queued", gen=1)
        _outbox(conn, "o-code", "code", "held")
        conn.execute("INSERT INTO ticket_templates(id, department_id, kind, purpose, name, title, body, lang, active, revision, updated_by, "
                     "updated_at, deleted_at) VALUES ('tpl1', NULL, 'message', 'assign', 'assign/he', '', ?, 'he', 1, 3, 'owner', ?, NULL)",
                     ("שלום {name}\n{link}\n" + OLD_HE, AT))
        conn.execute("INSERT INTO ticket_contacts(id, kind, display_name, created_by, created_at, updated_at, phone_confirmed_at) "
                     "VALUES ('c1', 'person', 'Dana Example', 'u', ?, ?, ?)", (AT, AT, AT))
        conn.execute("INSERT INTO ticket_contacts(id, kind, display_name, created_by, created_at, updated_at) "
                     "VALUES ('c2', 'vendor', 'Example Vendor', 'u', ?, ?)", (AT, AT))
        before = {r["id"]: dict(r) for r in conn.execute("SELECT * FROM ticket_outbox")}

    applied = dbmod.Database(settings.db_path).migrate()
    assert applied[:len(RELEASE)] == RELEASE and applied[len(RELEASE):] == [n for n in _numbers() if n > RELEASE[-1]]  # later changes (0094 TKWISECRYPT, 0095 USR1, ...) follow
    assert dbmod.Database(settings.db_path).migrate() == [], "each migration runs once"

    with database.connection() as conn:
        after = {r["id"]: dict(r) for r in conn.execute("SELECT * FROM ticket_outbox")}
        assert set(after) == set(before)
        for oid, row in before.items():
            assert {k: after[oid][k] for k in row} == row, oid  # every column of every row kept as it was
            assert after[oid]["rfq_id"] is None
        # the widened purposes: RFQ (0089) and number verification (TKNOTIFOTP, folded into the same rebuild)
        conn.execute("INSERT INTO ticket_outbox(id, recipient_kind, contact_id, channel, purpose, use_key, state, not_before, created_at, "
                     "updated_at, rfq_id) VALUES ('o-rfq', 'contact', 'c2', 'email', 'rfq_invite', 'email', 'queued', ?, ?, ?, 'r1')", (AT, AT, AT))
        conn.execute("INSERT INTO ticket_outbox(id, recipient_kind, contact_id, channel, purpose, use_key, state, not_before, created_at, "
                     "updated_at, code_id) VALUES ('o-pv', 'contact', 'c1', 'whatsapp', 'phone_verify', 'tickets.codes', 'queued', ?, ?, ?, 'pv1')",
                     (AT, AT, AT))
        with pytest.raises(sqlite3.IntegrityError):
            conn.execute("INSERT INTO ticket_outbox(id, recipient_kind, contact_id, channel, purpose, use_key, state, not_before, created_at, "
                         "updated_at) VALUES ('o-bad', 'contact', 'c1', 'whatsapp', 'bogus', 'x', 'queued', ?, ?, ?)", (AT, AT, AT))
        with pytest.raises(sqlite3.IntegrityError):  # the idempotency index survived
            conn.execute("INSERT INTO ticket_outbox(id, recipient_kind, contact_id, channel, purpose, use_key, state, not_before, created_at, "
                         "updated_at, idempotency_key) VALUES ('o-dup', 'contact', 'c1', 'whatsapp', 'assign', 'x', 'queued', ?, ?, ?, 'k-sent')",
                         (AT, AT, AT))
        indexes = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'ticket_outbox'")}
        assert {"idx_ticket_outbox_queue", "idx_ticket_outbox_ticket", "idx_ticket_outbox_contact_sent", "idx_ticket_outbox_provider",
                "idx_ticket_outbox_channel_sent", "idx_ticket_outbox_account_sent", "idx_ticket_outbox_updated",
                "idx_ticket_outbox_idempotency", "idx_ticket_outbox_rfq"} <= indexes

        tpl = dict(conn.execute("SELECT * FROM ticket_templates WHERE id = 'tpl1'").fetchone())
        assert tpl["body"] == "שלום {name}\n{link}\n" + NEW_HE and tpl["revision"] == 4 and tpl["updated_by"] == "system:migration-0092"
        via = dict(conn.execute("SELECT id, phone_confirmed_via FROM ticket_contacts").fetchall())
        assert via == {"c1": "user", "c2": None}
        for table in ("ticket_rfqs", "ticket_phone_verifications", "app_secrets"):
            assert conn.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?", (table,)).fetchone(), table

    # the quick-reply statement is idempotent: running 0092 again moves nothing
    sql = (dbmod.MIGRATIONS_DIR / "0092_ticket_template_quick_reply.sql").read_text(encoding="utf-8")
    with database.connection() as conn:
        conn.executescript(sql)
        again = dict(conn.execute("SELECT * FROM ticket_templates WHERE id = 'tpl1'").fetchone())
        assert again == tpl
        assert conn.execute("SELECT count(*) FROM ticket_outbox").fetchone()[0] == len(before) + 2
