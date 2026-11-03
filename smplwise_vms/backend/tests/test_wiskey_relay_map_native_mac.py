"""WISKEY-RC7-ADOPT-2331 (rc.7 map row 8): the WisKey Mac rc.7 contribution test of the relay map Native adapter, adopted as is.
SQLite/original exporter adapter units; the fake port is NOT Native proof. The symlink test needs POSIX (runner)."""
import os
import sqlite3
import sys

import pytest

from smplwise.db import Database
from smplwise.services import wiskey_relay_map as rm
from smplwise.services import wiskey_relay_map_export as rmx
from smplwise.services import wiskey_relay_map_native as native
from smplwise.services.wiskey_capture_port import PortIdentity, PortError


@pytest.fixture
def database(tmp_path):
    db = Database(tmp_path / "synthetic-arx.sqlite")
    db.migrate()
    with db.connection() as conn:
        rm.save(conn, station_id="synthetic-station", rows={1: 2, 2: 1}, expected_revision=0,
                by="synthetic-original-actor", known_relays=(1, 2))
    return db


class SyntheticPort:
    def __init__(self, db, *, fail=None, code=None):
        self.db, self.calls, self.fail, self.code = db, [], fail, code
        self.binding = {"repository_id": "913d2f99-4b2c-4216-a6c9-f825bd057953", "bridge_entry_id": "synthetic-bridge", "query_owner_id": "synthetic-subject", "connection_ref": "synthetic-connection"}

    def identity(self):
        return PortIdentity(self.binding["bridge_entry_id"], self.binding["query_owner_id"], self.binding["repository_id"], self.binding["connection_ref"])

    def call(self, command, parameters, *, timeout_s):
        assert timeout_s > 0
        self.calls.append((command, parameters))
        # An independent REAL writer can enter while the transport is called;
        # publication row is committed and visible, no DB gate held by caller.
        with self.db.connection(label="synthetic independent writer during transport") as conn:
            assert conn.execute("SELECT COUNT(*) FROM wiskey_relay_map_exports").fetchone()[0] >= 1
        if command == native.SOURCE:
            return {"contract": native.CONTRACT, "schema_version": 1, "binding": dict(self.binding), "inventory": {}, "anti_rollback_scope": "surviving_native_projection", "full_restore_continuity": "not_proven"}
        if self.fail:
            raise PortError(self.fail, "unknown")
        record = parameters["record"]
        return {"contract": "wiskey-relay-map-ack.v1", "schema_version": 1, "state": "staged", "code": self.code, "seq": record["seq"], "content_digest": record["content_digest"], "repository_id": self.binding["repository_id"], "projection_sha256": "a" * 64, "activation": "not_performed", "loaded": False, "ready": False}


def test_commit_before_io_and_native_correlated_staging_ack(database):
    port = SyntheticPort(database)
    result = native.publish(database, port, by="synthetic-original-actor")
    assert result["state"] == "staged"
    assert result["record"]["state"] == "acked" and result["record"]["acked_by"] == "native:synthetic-bridge"
    assert [command for command, _ in port.calls] == [native.SOURCE, native.STAGE]
    again = native.publish(database, port, by="synthetic-original-actor")
    assert again["record"]["seq"] == result["record"]["seq"]
    with database.connection() as conn:
        assert rm.station_state(conn, "synthetic-station")["revision"] == 1


def test_actual_sqlite_deferred_commit_failure_precedes_any_publication(database):
    with database.connection() as conn:
        conn.execute("CREATE TABLE synthetic_parent(id INTEGER PRIMARY KEY)")
        conn.execute("CREATE TABLE synthetic_deferred(child INTEGER REFERENCES synthetic_parent(id) DEFERRABLE INITIALLY DEFERRED)")
        conn.execute("CREATE TRIGGER synthetic_fail_commit AFTER INSERT ON wiskey_relay_map_exports BEGIN INSERT INTO synthetic_deferred VALUES(123); END")
    port = SyntheticPort(database)
    with pytest.raises(sqlite3.IntegrityError):
        native.publish(database, port, by="synthetic-original-actor")
    assert port.calls == []
    with database.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM wiskey_relay_map_exports").fetchone()[0] == 0


def test_lost_ack_stays_unknown_and_is_not_retried(database):
    port = SyntheticPort(database, fail="synthetic_ack_loss")
    with pytest.raises(PortError) as error:
        native.publish(database, port, by="synthetic-original-actor")
    assert error.value.outcome == "unknown"
    assert len(port.calls) == 2
    with database.connection() as conn:
        record = rmx.get(conn, 1)
        assert record.state == "exported" and record.acked_by is None


def test_incomplete_inactive_native_stage_is_not_exporter_ack(database):
    port = SyntheticPort(database, code="relay_export_inactive_mapping_requires_versioned_activation")
    result = native.publish(database, port, by="synthetic-original-actor")
    assert result["state"] == "staged_activation_blocked"
    with database.connection() as conn:
        assert rmx.get(conn, 1).state == "exported"


@pytest.mark.skipif(sys.platform == "win32" or not hasattr(os, "symlink"), reason="symlink fixture needs POSIX (runner)")
def test_original_manual_profile_guards_even_when_probe_or_marker_is_broken(tmp_path):
    from smplwise.services import wiskey_auto_install as install
    target = tmp_path / "custom_components/hikvision_intercom"
    target.mkdir(parents=True)
    payload = target / "unknown-owner-file"
    payload.write_bytes(b"synthetic preserve original foreign content")
    (target / "_manual_upgrade_profile.json").symlink_to(tmp_path / "missing-foreign-target")
    assert install.stage_native_bundle(tmp_path, tmp_path / "source-not-even-present", "synthetic") == "native_foreign_installed"
    assert payload.read_bytes() == b"synthetic preserve original foreign content"
