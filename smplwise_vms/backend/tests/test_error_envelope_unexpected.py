"""CR-MAIN-RUNTIME-2438 (review 05:P1-07 and 05:P3-02): an unexpected error and a busy database leave the API in the error
envelope ({code, user_message, retryable, correlation_id, details}) with the X-Correlation-Id header, instead of
Starlette's bare "Internal Server Error" text. Lead decision L1: both keep status 500 (the screens give 503 meanings of their
own); a busy database is marked retryable and carries a Retry-After hint. The disk-full answer (507) is unchanged."""
from __future__ import annotations

import re
import sqlite3

import pytest
from fastapi.testclient import TestClient

from smplwise.main import create_app

SERVER_ID = re.compile(r"^[0-9a-f]{12}$")
ENVELOPE = {"code", "user_message", "retryable", "correlation_id", "details"}


def _app(settings):
    app = create_app(settings)

    def bug():
        raise RuntimeError("a bug")

    def busy():
        raise sqlite3.OperationalError("database is locked")

    def other_db_error():
        raise sqlite3.OperationalError("no such table: nowhere")

    def full():
        raise sqlite3.OperationalError("database or disk is full")

    async def async_bug():
        raise KeyError("x")

    for path, fn in (("/t/bug", bug), ("/t/busy", busy), ("/t/other", other_db_error), ("/t/full", full), ("/t/abug", async_bug)):
        app.add_api_route(path, fn, methods=["GET"])
    return app


def test_an_unexpected_error_answers_the_envelope_with_status_500(settings):
    with TestClient(_app(settings), raise_server_exceptions=False) as c:
        for path in ("/t/bug", "/t/abug", "/t/other"):
            r = c.get(path)
            assert r.status_code == 500, path
            body = r.json()
            assert set(body) == ENVELOPE
            assert body["code"] == "internal_error" and body["retryable"] is False and body["details"] == {}
            assert body["user_message"]
            assert SERVER_ID.match(body["correlation_id"])
            assert r.headers["x-correlation-id"] == body["correlation_id"]


def test_a_well_formed_client_id_is_kept_on_the_unexpected_error(settings):
    with TestClient(_app(settings), raise_server_exceptions=False) as c:
        r = c.get("/t/bug", headers={"X-Correlation-Id": "client-id-0001"})
        assert r.status_code == 500
        assert r.json()["correlation_id"] == "client-id-0001" == r.headers["x-correlation-id"]
        bad = c.get("/t/bug", headers={"X-Correlation-Id": "bad id\r\nx"})
        assert SERVER_ID.match(bad.json()["correlation_id"]) and bad.headers["x-correlation-id"] == bad.json()["correlation_id"]


def test_the_server_still_sees_the_unexpected_exception(settings):
    """Starlette re-raises after the envelope, so the server logs the traceback (and a test client raises) as before."""
    with TestClient(_app(settings)) as c:
        with pytest.raises(RuntimeError, match="a bug"):
            c.get("/t/bug")
        with pytest.raises(sqlite3.OperationalError, match="no such table"):
            c.get("/t/other")


def test_a_busy_database_answers_database_busy_retryable(settings, caplog):
    with TestClient(_app(settings)) as c:  # handled, not re-raised: a busy database is an expected answer
        r = c.get("/t/busy", headers={"X-Correlation-Id": "busy-req-0001"})
    assert r.status_code == 500
    body = r.json()
    assert set(body) == ENVELOPE
    assert body["code"] == "database_busy" and body["retryable"] is True and body["details"] == {"retry_after_s": 2}
    assert body["correlation_id"] == "busy-req-0001" == r.headers["x-correlation-id"]
    assert r.headers["retry-after"] == "2"
    assert any("database busy" in rec.getMessage() and "/t/busy" in rec.getMessage() for rec in caplog.records)


def test_disk_full_is_unchanged(settings):
    with TestClient(_app(settings)) as c:
        r = c.get("/t/full")
    assert r.status_code == 507 and r.json()["code"] == "storage_full" and r.json()["retryable"] is False


def test_ordinary_answers_still_carry_the_correlation_header(settings):
    with TestClient(_app(settings)) as c:
        ok = c.get("/healthz", headers={"X-Correlation-Id": "health-0001"})
        missing = c.get("/api/v1/does-not-exist")
    assert ok.status_code == 200 and ok.headers["x-correlation-id"] == "health-0001"
    assert missing.status_code == 404 and missing.json()["correlation_id"] == missing.headers["x-correlation-id"]
