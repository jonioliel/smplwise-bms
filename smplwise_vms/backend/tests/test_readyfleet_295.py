"""READYFLEET-295: CR-FLEET215's fleet report reads CR-READY96's readiness - one evaluation, one id set, one screen.

Negative first: the old FLEET215 readiness / demo modules and routes are gone (no second rule, no `demo.enabled` switch, no
`/demo/dataset`); nothing is sent or due while a CR-READY96 demo runs. Then the projection: the report's readiness block equals
what `readiness.evaluate()` says, and follows the `readiness.*` settings edited in Settings. Fakes only: no receiver, no device."""
from __future__ import annotations

import httpx
import pytest
from fastapi.testclient import TestClient

from smplwise.db import Database
from smplwise.routers import readiness as readiness_router
from smplwise.services import demo_mode, readiness
from smplwise.services import fleet_report as fr

API = "/api/v1"
URL = "https://fleet-receiver.test/base"


@pytest.fixture(autouse=True)
def _fresh(monkeypatch):
    readiness_router._last_check.clear()
    monkeypatch.delenv(fr.URL_ENV, raising=False)
    yield
    readiness_router._last_check.clear()


@pytest.fixture()
def c(client: TestClient) -> TestClient:
    client.get(f"{API}/me")  # the bootstrap administrator
    return client


def _db(settings) -> Database:
    return Database(settings.db_path)


def _body(settings) -> dict:
    with _db(settings).connection(mode="read") as conn:
        return fr.build_body(settings, conn, probe=False)


# ---------------------------------------------------------------- one source of truth

def test_there_is_no_second_readiness_rule_or_demo_switch():
    assert not hasattr(readiness, "compute") and not hasattr(readiness, "ITEM_IDS"), "the FLEET215 checklist was folded into CR-READY96"
    assert not hasattr(demo_mode, "dataset") and not hasattr(demo_mode, "SWITCH"), "the FLEET215 example-data switch was folded into CR-READY96"
    assert not hasattr(fr, "DEMO_SWITCH")
    assert fr.SCHEMA_KEYS["readiness"]["missing"] == ("ids", readiness.CHECK_IDS)
    assert readiness.CHECK_IDS == tuple(readiness.CHECKS)


def test_the_old_fleet_demo_routes_are_gone(c: TestClient):
    assert c.get(f"{API}/demo/dataset").status_code in (404, 405)
    assert c.put(f"{API}/demo", json={"enabled": True}).status_code in (404, 405)
    r = c.get(f"{API}/readiness").json()
    assert "checks" in r and "items" not in r, "GET /readiness is CR-READY96's report"


def test_the_report_block_is_a_projection_of_evaluate(c: TestClient, settings):
    with _db(settings).connection(mode="read") as conn:
        report = readiness.evaluate(conn, settings)
    block = _body(settings)["readiness"]
    assert block["score"] == report["score"]
    assert block["ready"] is report["handover"]["advice_met"]
    expected = {x["id"] for x in report["checks"] if x["applicable"] and x["status"] in ("attention", "blocked", "pending")}
    assert set(block["missing"]) == expected and len(block["missing"]) == len(expected)
    blockers = [m for m in block["missing"] if m in report["handover"]["blockers"]]
    assert block["missing"][: len(blockers)] == blockers, "critical checks first"
    assert "modules" not in block["missing"], "a not-applicable check is never 'missing'"
    fr.validate({**_body(settings), "installation_id": "a" * 32, "seq": 1, "generated_at": "2026-10-23T03:00:00Z"})


def test_the_block_follows_the_readiness_settings(c: TestClient, settings):
    before = _body(settings)["readiness"]
    assert "backup" in before["missing"] and before["ready"] is False
    ok = c.put(f"{API}/readiness/settings", json={"changes": {"readiness.weight.backup": "0"}, "confirmed": True})
    assert ok.status_code == 200
    after = _body(settings)["readiness"]
    assert "backup" not in after["missing"], "weight 0 takes the check out, in the report too"
    score = c.get(f"{API}/readiness").json()["score"]
    assert after["score"] == score
    # the hand-over advice is a setting as well: low bands + every critical check out -> the report says ready
    changes = {f"readiness.weight.{cid}": "0" for cid in readiness.CRITICAL} | {"readiness.advice_score": "2", "readiness.band_almost_min": "1"}
    assert c.put(f"{API}/readiness/settings", json={"changes": changes, "confirmed": True}).status_code == 200
    with _db(settings).connection(mode="read") as conn:
        report = readiness.evaluate(conn, settings)
    assert _body(settings)["readiness"]["ready"] is report["handover"]["advice_met"]


def test_the_projection_ignores_unknown_ids_and_bad_values():
    report = {"score": 140, "handover": {"advice_met": True}, "checks": [
        {"id": "not_a_check", "applicable": True, "status": "blocked", "gain": 9},
        {"id": "backup", "applicable": True, "status": "attention", "gain": 2},
        {"id": "places", "applicable": True, "status": "blocked", "gain": 1},
        {"id": "time", "applicable": False, "status": "not_applicable", "gain": 0},
        {"id": "people", "applicable": True, "status": "ok", "gain": 0},
    ]}
    assert fr.readiness_block(report) == {"score": 100, "ready": True, "missing": ["places", "backup"]}
    assert fr.readiness_block({}) == {"score": 0, "ready": False, "missing": []}


# ---------------------------------------------------------------- demo mode (CR-READY96) and the report

class _Receiver:
    def __init__(self) -> None:
        self.requests: list[httpx.Request] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        return httpx.Response(202, json={"ok": True})


def test_nothing_is_sent_or_due_while_a_demo_runs(c: TestClient, settings, monkeypatch):
    fake = _Receiver()
    monkeypatch.setattr(fr, "TRANSPORT", httpx.MockTransport(fake))
    monkeypatch.setenv(fr.URL_ENV, URL)
    db = _db(settings)
    with db.connection() as conn:
        conn.execute("INSERT INTO settings(key, value) VALUES(?, 'true') ON CONFLICT(key) DO UPDATE SET value = excluded.value", (fr.SWITCH,))
    db.demo, db.demo_state = True, {"dataset": "office", "scenario": "normal", "started_at": "x", "expires_at": "y", "started_by": "u", "started_by_name": "u"}
    assert demo_mode.active(db)
    assert fr.send_once(db, settings) == {"sent": False, "result": "demo_active"}
    assert fr.tick(db, settings) is None
    assert fake.requests == []
    db.demo, db.demo_state = False, None
    assert fr.send_once(db, settings)["result"] == "ok", "control: the same handle sends once the demo is over"
    assert len(fake.requests) == 1


def test_send_now_is_refused_while_a_demo_runs(c: TestClient, settings, monkeypatch):
    monkeypatch.setenv(fr.URL_ENV, URL)
    assert c.put(f"{API}/fleet/report", json={"enabled": True}).status_code == 200
    db = c.app.state.db
    monkeypatch.setattr(db, "demo", True, raising=False)
    monkeypatch.setattr(db, "demo_state", {"dataset": "office"}, raising=False)
    r = c.post(f"{API}/fleet/report/send")
    assert r.status_code == 409 and r.json()["code"] == "demo_active", r.text


def test_the_demo_mark_sets_demo_mode_in_the_body(c: TestClient, settings):
    assert _body(settings)["demo_mode"] is False
    with _db(settings).connection() as conn:
        conn.execute("INSERT INTO settings(key, value) VALUES(?, 'true')", (fr.DEMO_MARK,))
    assert _body(settings)["demo_mode"] is True, "a body ever built from a demo database says so"
