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


class _Action:
    """A product-like holder of a connection (routers/access_control._Action keeps it as act.conn)."""

    def __init__(self, conn) -> None:
        self.conn = conn


_Action.__module__ = "smplwise.fake"


def test_guard_sees_attributes_manual_commits_and_other_entry_points(tmp_path):
    import socket
    import urllib.request

    db = Database(tmp_path / "t.db")
    db.migrate()
    db_io_guard.FINDINGS.items.clear()
    mp = pytest.MonkeyPatch()
    db_io_guard.install(mp.setattr)
    try:
        client = httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(200)), base_url="http://nvr.test")

        def through_an_attribute() -> None:
            with db.connection(label="attr holder") as conn:
                act = _Action(conn)
                del conn
                client.get("/a")
                assert act

        def after_a_manual_commit() -> None:
            with db.connection(label="manual") as conn:
                conn.execute("COMMIT")  # keeps the gate (the bug commit_now prevents)
                client.get("/b")

        def raw_socket_and_urllib() -> None:
            with db.connection(label="sockets") as conn:
                assert conn
                s = socket.socket()
                s.settimeout(0.2)
                try:
                    s.connect(("127.0.0.1", 9))
                except OSError:
                    pass
                finally:
                    s.close()
                try:
                    urllib.request.urlopen("http://127.0.0.1:9/", timeout=0.2)
                except OSError:
                    pass

        through_an_attribute()
        after_a_manual_commit()
        raw_socket_and_urllib()
    finally:
        mp.undo()
    found = {(f["kind"], f["holder"]) for f in db_io_guard.FINDINGS.report()}
    db_io_guard.FINDINGS.items.clear()
    assert ("http", "attr holder") in found
    assert ("http/gate-outside-tx", "manual") in found
    assert ("socket", "sockets") in found and ("urllib", "sockets") in found
