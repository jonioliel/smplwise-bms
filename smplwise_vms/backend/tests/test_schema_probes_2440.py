"""CR-SCHEMA-PROBES-2440 (review 05:P2-10): the run-time schema probes that moved to `db.has_table` / `db.has_column` answer what
their own SQL answered - on a database file (the cached path, including right after the schema changes), on a pooled connection and
on a database with no file (asked directly)."""
from __future__ import annotations

import sqlite3

import pytest

from smplwise import db as dbmod
from smplwise.services import autosync, bridge_rotation, capture_lease, energy_calibration, events_ingest, fleet_report


@pytest.fixture(params=["file", "memory"])
def conn(request, tmp_path):
    dbmod.forget_schema_cache()
    c = sqlite3.connect(str(tmp_path / "probe.db") if request.param == "file" else ":memory:")
    yield c
    c.close()
    dbmod.forget_schema_cache()


def _old_table(conn, name):
    return conn.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?", (name,)).fetchone() is not None


def _old_column(conn, table, column):
    return any(r[1] == column for r in conn.execute(f"PRAGMA table_info({table})").fetchall())


def test_single_table_probes_follow_the_schema(conn):
    probes = [(bridge_rotation._has_tables, "bridge_keys"), (energy_calibration.has_tables, "energy_meter_calibrations"),
              (lambda c: fleet_report._table(c, "notifications"), "notifications")]
    for probe, table in probes:
        assert probe(conn) is False and _old_table(conn, table) is False
        conn.execute(f"CREATE TABLE {table} (id TEXT)")
        conn.commit()
        assert probe(conn) is True and _old_table(conn, table) is True   # a schema change is seen at once (the cache key has the schema version)
        conn.execute(f"DROP TABLE {table}")
        conn.commit()
        assert probe(conn) is False


def test_a_view_or_an_index_is_not_a_table(conn):
    conn.execute("CREATE TABLE t (id TEXT)")
    conn.execute("CREATE VIEW bridge_keys AS SELECT id FROM t")
    conn.commit()
    assert bridge_rotation._has_tables(conn) is False and _old_table(conn, "bridge_keys") is False


def test_capture_lease_needs_both_tables(conn):
    def old(c):
        return c.execute("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN ('capture_leases', 'capture_lease_stream')").fetchone()[0] == 2

    assert capture_lease.tables_present(conn) is False is old(conn)
    conn.execute("CREATE TABLE capture_leases (id TEXT)")
    conn.commit()
    assert capture_lease.tables_present(conn) is False is old(conn)
    conn.execute("CREATE TABLE capture_lease_stream (id TEXT)")
    conn.commit()
    assert capture_lease.tables_present(conn) is True is old(conn)


def test_capture_lease_probe_still_answers_false_on_a_closed_connection(tmp_path):
    c = sqlite3.connect(str(tmp_path / "x.db"))
    c.close()
    assert capture_lease.tables_present(c) is False and energy_calibration.has_tables(c) is False  # sqlite3.Error -> False, as before


def test_column_probes_follow_the_schema(conn):
    assert events_ingest._has_recorder_column(conn) is False is _old_column(conn, "events", "recorder_id")   # no table: no column
    conn.execute("CREATE TABLE events (id TEXT)")
    conn.commit()
    assert events_ingest._has_recorder_column(conn) is False is _old_column(conn, "events", "recorder_id")
    conn.execute("ALTER TABLE events ADD COLUMN recorder_id TEXT")
    conn.commit()
    assert events_ingest._has_recorder_column(conn) is True is _old_column(conn, "events", "recorder_id")
    conn.execute("CREATE TABLE cameras (id TEXT, source_ref TEXT)")
    conn.commit()
    assert autosync._has_column(conn, "cameras", "source_ref") is True and autosync._has_column(conn, "cameras", "nope") is False
    assert autosync._has_column(conn, "absent", "x") is False is _old_column(conn, "absent", "x")


def test_an_uncommitted_create_is_seen_by_its_own_transaction_and_not_remembered(tmp_path):
    dbmod.forget_schema_cache()
    path = str(tmp_path / "tx.db")
    a = sqlite3.connect(path)
    a.execute("CREATE TABLE seed (id TEXT)")
    a.commit()
    a.execute("BEGIN IMMEDIATE")
    a.execute("CREATE TABLE bridge_keys (id TEXT)")
    assert bridge_rotation._has_tables(a) is True      # its own uncommitted change
    a.rollback()
    assert bridge_rotation._has_tables(a) is False     # the rolled-back answer was not cached
    b = sqlite3.connect(path)
    assert bridge_rotation._has_tables(b) is False
    a.close()
    b.close()
    dbmod.forget_schema_cache()


def test_the_migrated_database_has_every_probed_object(client):
    """On a migrated database every one of these probes is True - the fallbacks behind them are kept (marked verify), not removed."""
    database = client.app.state.db
    with database.connection(mode="read") as c:
        assert bridge_rotation._has_tables(c) and energy_calibration.has_tables(c) and capture_lease.tables_present(c)
        assert events_ingest._has_recorder_column(c) and autosync._has_column(c, "cameras", "source_ref")
        for table in ("auth_local_sessions", "auth_local_reset_codes", "plan_bakes", "water_bills", "notifications", "recorder_connections"):
            assert dbmod.has_table(c, table), table
        assert dbmod.has_column(c, "ha_devices", "parent_device_id")
