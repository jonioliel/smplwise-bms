"""CR-TK-SQL (code review 2026-11-13, 01:F-14 / 01:F-10): the shared SQL helpers of the tickets store modules.

`services/tickets/_sql.py` replaced six copies of `_dict`, three of `_insert`, two copies of the scope prefilter and of the free-text
clause in store.py, and the inline LIKE escapes. The reference implementations below are the pre-change text of store.py (v2.43.6),
kept verbatim, so the helpers are pinned to give the same SQL text and the same arguments.

The second half pins 01:F-10: every table the module still asks about at run time exists on a migrated database (so each guarded
branch always runs in the product), and the store modules ask through the one cached `db.has_table`. Every value here is invented."""
from __future__ import annotations

import sqlite3
from typing import Any, Iterable

import pytest

from smplwise import db as dbmod
from smplwise.db import Database
from smplwise.services.tickets import (_sql, out_documents, store, store_costs, store_links, store_locations, store_quotes, store_rfq,
                                       store_visits, vendor_documents)


# ---------------------------------------------------------------- the pre-change text (store.py, v2.43.6)

def _old_scope(department_ids: Iterable[str] | None, user_id: str | None) -> tuple[list[str], list[Any]] | None:
    where: list[str] = []
    args: list[Any] = []
    scope_parts: list[str] = []
    if department_ids is not None:
        ids = list(dict.fromkeys(department_ids))
        if ids:
            scope_parts.append(f"t.department_id IN ({', '.join('?' * len(ids))})")
            args.extend(ids)
    else:
        scope_parts.append("1 = 1")
    if user_id:
        scope_parts.append("(t.created_by = ? OR (a.assignee_kind = 'user' AND a.user_id = ? AND a.ended_at IS NULL))")
        args.extend([user_id, user_id])
    if not scope_parts:
        return None
    where.append("(" + " OR ".join(scope_parts) + ")")
    return where, args


def _old_text(query: str | None) -> tuple[list[str], list[Any]]:
    where: list[str] = []
    args: list[Any] = []
    q = (query or "").strip()
    if q:
        digits = q.lstrip("#")
        if digits.isdigit() and len(digits) <= 9:
            where.append("(t.number = ? OR t.title LIKE ? ESCAPE '\\' OR t.device_name LIKE ? ESCAPE '\\')")
            like = "%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
            args.extend([int(digits), like, like])
        else:
            like = "%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
            where.append("(t.title LIKE ? ESCAPE '\\' OR t.device_name LIKE ? ESCAPE '\\' OR t.place_text LIKE ? ESCAPE '\\')")
            args.extend([like, like, like])
    return where, args


SCOPES = [(None, None), (None, "u1"), ([], None), ([], "u1"), (["d1"], None), (["d1", "d2", "d1"], "u1"), (("d2", "d1"), ""),
          (iter(["d3"]), "u9")]
QUERIES = [None, "", "   ", "12", "#12", " #0042 ", "1234567890", "##7", "#", "דלת", "50%_off\\x", "a_b", "  leak  ", "12a", "١٢"]


@pytest.mark.parametrize("case", range(len(SCOPES)))
def test_scope_clause_is_the_old_text(case):
    departments, user = SCOPES[case]
    again = list(departments) if departments is not None else None  # an iterator is read once: give each side its own
    old = _old_scope(again, user)
    new = _sql.scope_clause(list(again) if again is not None else None, user)
    if old is None:
        assert new is None
    else:
        assert new is not None and ([new[0]], new[1]) == old


@pytest.mark.parametrize("query", QUERIES)
def test_text_clause_is_the_old_text(query):
    old_where, old_args = _old_text(query)
    new = _sql.text_clause(query)
    if not old_where:
        assert new is None
    else:
        assert new is not None and [new[0]] == old_where and new[1] == old_args


def test_like_matches_wildcards_literally():
    conn = sqlite3.connect(":memory:")
    for text, needle, hit in (("50% off", "50%", True), ("500 off", "50%", False), ("a_b", "a_b", True), ("axb", "a_b", False),
                              ("c:\\dir", "\\d", True), ("c:dir", "\\d", False)):
        got = conn.execute("SELECT ? LIKE ? ESCAPE '\\'", (text, _sql.like(needle))).fetchone()[0]
        assert bool(got) is hit, (text, needle)


def test_row_dict_and_insert():
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute("CREATE TABLE t (id TEXT, n INTEGER, note TEXT)")
    _sql.insert(conn, "t", {"id": "a", "n": 3})
    row = conn.execute("SELECT * FROM t").fetchone()
    assert _sql.row_dict(row) == {"id": "a", "n": 3, "note": None}
    assert _sql.row_dict(None) is None


def test_the_store_modules_share_the_helpers():
    """One implementation behind every old private name (the names stay, so no call site moved)."""
    for mod in (store, store_costs, store_links, store_locations, store_quotes, store_rfq):
        assert mod._dict is _sql.row_dict, mod.__name__
    assert store_visits._d is _sql.row_dict
    for mod in (store_costs, store_quotes, store_rfq):
        assert mod._insert is _sql.insert, mod.__name__
    assert store._like is _sql.like
    for mod in (store, store_links, store_rfq):
        assert mod._has_table is dbmod.has_table, mod.__name__
    assert out_documents.has_table is dbmod.has_table and vendor_documents.has_table is dbmod.has_table


# ---------------------------------------------------------------- 01:F-10: the tables the module still asks about

PROBED = ("ticket_links", "ticket_quotes", "ticket_map_elements", "ticket_rfq_attachment_refs", "ticket_rfq_vendor_file_refs",
          "ticket_visits", "ticket_rfq_attachments", "ticket_rfq_vendor_files", "ticket_rfq_links", "ticket_rfq_postponements",
          "ticket_rfq_instalment_demands", "ticket_portal_codes", "ticket_portal_sessions", "ticket_phone_verifications",
          "intercom_consent_requests", "outbound_documents", "maint_tasks")


@pytest.fixture()
def db(client, settings):
    client.get("/api/v1/me")  # the app's start-up migrated the database
    return Database(settings.db_path)


def test_every_probed_table_exists_after_the_migrations(db):
    """On a migrated database every probe answers yes - the guarded branches always run; the probes only serve a partial schema."""
    with db.connection() as conn:
        missing = [t for t in PROBED if not _sql.has_table(conn, t)]
        assert missing == []
        assert not _sql.has_table(conn, "ticket_no_such_table")
        assert store_rfq.has_postponements(conn) and store_rfq.has_attachments(conn) and store_rfq.has_vendor_files(conn)
        assert store_links._has_rfq_links(conn)


def test_the_probe_sees_a_table_created_later(tmp_path):
    """The cached answer follows the schema version: a table created after the first question is seen at once (a partial schema that a
    test or a migration completes)."""
    path = tmp_path / "partial.db"
    conn = sqlite3.connect(path)
    try:
        conn.execute("CREATE TABLE ticket_contacts (id TEXT, phone_key TEXT, phone_key_id TEXT)")
        conn.execute("CREATE TABLE ticket_links (id TEXT, key_id TEXT, revoked_at TEXT)")
        conn.commit()
        assert not store_rfq.has_attachments(conn) and not store_links._has_rfq_links(conn)
        assert store_links.any_keyed_row(conn) is False and store_links.key_ids_in_use(conn) == set()
        conn.execute("CREATE TABLE ticket_rfq_links (id TEXT, key_id TEXT, revoked_at TEXT)")
        conn.execute("INSERT INTO ticket_rfq_links VALUES ('l1', 'k7', NULL)")
        conn.commit()
        assert store_links._has_rfq_links(conn)
        assert store_links.any_keyed_row(conn) is True and store_links.key_ids_in_use(conn) == {"k7"}
    finally:
        conn.close()
        dbmod.forget_schema_cache()
