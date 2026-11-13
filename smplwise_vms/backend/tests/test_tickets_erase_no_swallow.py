"""TICKETS-PERF-ERASE-2435 (code review 2026-11-13, F-03): an erase never reports success while its rows remain.

vendor_portal.forget_contact and portal_more.forget_contact (section 15.2) used to wrap their DELETEs in `except Exception: pass`
("a database before 0105 / 0112"), so a locked database or any other failure also passed silently and POST .../erase answered
`erased: true` with the portal code rows (the keyed number index) or the technician requests (a name and a number) still there.
Now only a missing table is ignored (store.table_missing); any other failure fails the erase, like the DELETE of
ticket_phone_verifications beside it always did. The janitor's retention DELETEs log such a failure and go on.

The failure is forced by a real SQLite trigger (`RAISE(ABORT)`) on the real migrated schema. Every name and number is invented."""
from __future__ import annotations

import logging
import sqlite3

import pytest

from smplwise.services.tickets import portal_more, store, vendor_portal
from tickets_s4_world import API, build_s4

NOW = "2026-11-13T10:00:00Z"


@pytest.fixture()
def s4(settings, monkeypatch):
    return build_s4(settings, monkeypatch)


def _code_row(conn, contact_id: str, n: int = 1) -> None:
    conn.execute("INSERT INTO ticket_portal_codes (id, phone_key, key_id, code_hash, contact_id, created_at, expires_at) "
                 "VALUES (?, 'pk-test', 'k1', 'h', ?, ?, ?)", (f"{n:032x}", contact_id, NOW, NOW))


def _tech_request(conn, vendor_id: str) -> None:
    conn.execute("INSERT INTO ticket_portal_tech_requests(id, vendor_id, sender_contact_id, action, display_name, phone_e164, state, created_at) "
                 "VALUES ('req-f03-0001', ?, ?, 'add', 'יוסי כהן', '+972500000999', 'pending', ?)", (vendor_id, vendor_id, NOW))


def _block_delete(conn, table: str) -> None:
    conn.execute(f"CREATE TRIGGER f03_block_{table} BEFORE DELETE ON {table} BEGIN SELECT RAISE(ABORT, 'f03 forced failure'); END")


def _count(conn, table: str, where: str, arg: str) -> int:
    return conn.execute(f"SELECT COUNT(*) FROM {table} WHERE {where}", (arg,)).fetchone()[0]


def _erase(s4, contact_id: str):
    """POST .../erase; an exception the app does not turn into a response counts as 'not reported as success' too."""
    try:
        return s4.c.post(f"{API}/tickets/contacts/{contact_id}/erase", json={"confirm": True})
    except sqlite3.DatabaseError as exc:
        return exc


# ---------------------------------------------------------------- the helper


def test_only_a_missing_table_counts_as_missing():
    assert store.table_missing(sqlite3.OperationalError("no such table: ticket_portal_codes"))
    assert not store.table_missing(sqlite3.OperationalError("database is locked"))
    assert not store.table_missing(sqlite3.IntegrityError("no such table: x"))  # only the OperationalError of a missing table
    assert not store.table_missing(RuntimeError("no such table: x"))


# ---------------------------------------------------------------- the erase route


def test_the_successful_erase_is_unchanged_and_deletes_the_portal_rows(s4):
    cid = s4.contact["id"]
    with s4.db.connection() as conn:
        _code_row(conn, cid)
    r = _erase(s4, cid)
    assert r.status_code == 200 and r.json()["erased"] is True, r.text
    with s4.db.connection(mode="read") as conn:
        assert _count(conn, "ticket_portal_codes", "contact_id = ?", cid) == 0


def test_a_failing_portal_code_delete_fails_the_erase(s4):
    cid = s4.contact["id"]
    with s4.db.connection() as conn:
        _code_row(conn, cid)
        _block_delete(conn, "ticket_portal_codes")
    r = _erase(s4, cid)
    assert isinstance(r, sqlite3.DatabaseError) or r.status_code >= 500, "a failed DELETE must never be reported as an erase"
    if not isinstance(r, sqlite3.DatabaseError):
        assert "erased" not in r.text
    with s4.db.connection(mode="read") as conn:
        assert _count(conn, "ticket_portal_codes", "contact_id = ?", cid) == 1
        assert conn.execute("SELECT erased_at FROM ticket_contacts WHERE id = ?", (cid,)).fetchone()[0] is None, \
            "the erase transaction rolled back as a whole: the row is not half erased"


def test_a_failing_technician_request_delete_fails_the_erase(s4):
    cid = s4.contact["id"]
    with s4.db.connection() as conn:
        _tech_request(conn, cid)
        _block_delete(conn, "ticket_portal_tech_requests")
    r = _erase(s4, cid)
    assert isinstance(r, sqlite3.DatabaseError) or r.status_code >= 500
    with s4.db.connection(mode="read") as conn:
        assert _count(conn, "ticket_portal_tech_requests", "vendor_id = ?", cid) == 1


# ---------------------------------------------------------------- the service functions


def test_forget_contact_raises_on_a_failing_delete(s4):
    cid = s4.contact["id"]
    with s4.db.connection() as conn:
        _code_row(conn, cid)
        _block_delete(conn, "ticket_portal_codes")
    with s4.db.connection() as conn, pytest.raises(sqlite3.DatabaseError, match="f03 forced failure"):
        vendor_portal.forget_contact(conn, cid)
    with s4.db.connection() as conn:
        _tech_request(conn, cid)
        _block_delete(conn, "ticket_portal_tech_requests")
    with s4.db.connection() as conn, pytest.raises(sqlite3.DatabaseError, match="f03 forced failure"):
        portal_more.forget_contact(conn, cid)


def test_forget_contact_still_passes_on_a_database_without_the_tables(s4):
    cid = s4.contact["id"]
    conn = sqlite3.connect(":memory:")  # a database before 0105 / 0112: neither table exists
    try:
        vendor_portal.forget_contact(conn, cid)
        portal_more.forget_contact(conn, cid)
    finally:
        conn.close()


def test_the_janitor_logs_a_failing_retention_delete_and_goes_on(s4, caplog):
    import datetime as dt

    with s4.db.connection() as conn:
        _code_row(conn, s4.contact["id"])
        conn.execute("UPDATE ticket_portal_codes SET created_at = '2020-01-01T00:00:00Z'")
        _block_delete(conn, "ticket_portal_codes")
    caplog.set_level(logging.WARNING, logger="smplwise.tickets.vendor_portal")
    with s4.db.connection() as conn:
        vendor_portal.prune(conn, dt.datetime(2026, 11, 13, tzinfo=dt.timezone.utc))  # does not raise: the janitor goes on
    assert any("retention failed" in r.getMessage() for r in caplog.records), [r.getMessage() for r in caplog.records]
    caplog.clear()
    mem = sqlite3.connect(":memory:")
    try:
        vendor_portal.prune(mem, dt.datetime(2026, 11, 13, tzinfo=dt.timezone.utc))  # a database before 0105: silent, as before
    finally:
        mem.close()
    assert not any("retention failed" in r.getMessage() for r in caplog.records)
