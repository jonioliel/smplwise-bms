"""The SW_DB_IO_GUARD diagnostic (tests/db_io_guard.py) sees device I/O under a held write lock - and only that."""
from __future__ import annotations

import httpx
import pytest

import db_io_guard
from smplwise.db import Database, unlocked


def test_guard_reports_http_under_the_write_lock_and_nothing_else(tmp_path):
    db = Database(tmp_path / "t.db")
    db.migrate()
    db_io_guard.FINDINGS.items.clear()
    mp = pytest.MonkeyPatch()
    db_io_guard.install(mp.setattr)
    try:
        client = httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(200)), base_url="http://nvr.test")

        def device_call_under_lock() -> None:
            with db.connection(label="culprit") as conn:
                conn.execute("SELECT 1")
                client.get("/ISAPI/x")

        def device_call_done_right() -> None:
            with db.connection(label="clean") as conn:
                with unlocked(conn):
                    client.get("/ISAPI/y")
            with db.connection(mode="read") as conn:  # readers hold no write lock
                client.get("/ISAPI/z")
            client.get("/ISAPI/w")

        device_call_under_lock()
        device_call_done_right()
    finally:
        mp.undo()
    found = db_io_guard.FINDINGS.report()
    db_io_guard.FINDINGS.items.clear()
    assert [(f["holder"], f["targets"]) for f in found] == [("culprit", ["GET nvr.test/ISAPI/x"])]
    assert "device_call_under_lock" in found[0]["where"]
