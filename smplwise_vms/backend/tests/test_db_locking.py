"""Write-lock discipline (round-10 "database is locked" storm): no device call, notification or response transfer runs
while SQLite's single write lock is held, busy writes are retried instead of dropped, and every hold is accounted for.
Each fake device checks, at the moment it is called, that another writer can take the lock without waiting."""
from __future__ import annotations

import asyncio
import datetime as dt
import json
import logging
import sqlite3
import threading
import time
from dataclasses import replace
from typing import Any

import httpx
import pytest
from conftest import as_user, png_bytes, seed_tree
from fastapi.testclient import TestClient
from test_devices import dev_app  # noqa: F401 - fixture
from test_exports import fake_pages
from test_recordings import set_track

from smplwise import db as db_mod
from smplwise.db import Database, retry_locked
from smplwise.main import create_app
from smplwise.services import events_ingest, ha_client, ha_sync, nvr, nvr_write, recordings
from smplwise.services import rules as rules_svc


def lock_is_free(db: Database) -> bool:
    """True when another connection takes the write lock at once (busy timeout 0)."""
    probe = sqlite3.connect(db.path, timeout=0, isolation_level=None)
    try:
        probe.execute("BEGIN IMMEDIATE")
        probe.execute("ROLLBACK")
        return True
    except sqlite3.OperationalError:
        return False
    finally:
        probe.close()


def test_request_commits_before_the_response_is_sent(settings):
    """A dependency with yield is closed after the body went out; the write lock must not ride along with the transfer
    (/health runs on a write-mode request connection)."""
    app = create_app(settings)
    TestClient(app).get("/api/v1/me")  # bootstrap the dev user
    db: Database = app.state.db
    seen: dict[str, bool] = {}

    async def drive() -> None:
        scope = {"type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1", "method": "GET", "scheme": "http", "path": "/api/v1/health", "raw_path": b"/api/v1/health",
                 "root_path": "", "query_string": b"", "headers": [(b"host", b"testserver")], "client": ("127.0.0.1", 5000), "server": ("testserver", 80)}

        async def receive():
            return {"type": "http.request", "body": b"", "more_body": False}

        async def send(message):
            if message["type"] == "http.response.start":
                seen["status"] = message["status"]
                seen["free_at_start"] = await asyncio.to_thread(lock_is_free, db)

        await app(scope, receive, send)

    asyncio.run(drive())
    assert seen == {"status": 200, "free_at_start": True}


def test_rule_notification_is_sent_after_the_alert_commit(settings, monkeypatch):
    s = replace(settings, nvr_host="nvr.local", nvr_user="u", nvr_password="p")
    app = create_app(s)
    c = TestClient(app)
    c.post("/api/v1/cameras", json={"channel": 1, "alias": "lobby"})
    db: Database = app.state.db
    with db.connection() as conn:
        conn.execute("INSERT INTO rules(id, name, trigger_json, scope_json, window_json, cooldown_s, actions_json, created_at, updated_at) VALUES "
                     "('r1', 'person', '{\"types\": [\"person\"]}', '{}', '{}', 0, '[{\"kind\": \"ha_notify\", \"service\": \"mobile_app_phone\"}]', '2026-09-29T00:00:00Z', '2026-09-29T00:00:00Z')")
    free: list[bool] = []
    monkeypatch.setattr(rules_svc, "HA_NOTIFY", lambda service, message, title: (free.append(lock_is_free(db)), "sent")[1])
    monkeypatch.setattr(events_ingest.LISTENER, "db", db)
    monkeypatch.setattr(events_ingest.LISTENER, "settings", s)
    monkeypatch.setattr(events_ingest.LISTENER, "tz_getter", lambda: "Asia/Jerusalem")
    now =dt.datetime.now(dt.timezone(dt.timedelta(hours=3))).replace(microsecond=0).isoformat()
    events_ingest.LISTENER._handle(events_ingest.ParsedAlert(raw_type="linedetection", state="active", channel=1, dyn_channel=None, device_time=now, description="",
                                                             target="human", active_post_count=1))
    assert free == [True]
    with db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM rule_alerts WHERE rule_id = 'r1'").fetchone()[0] == 1
    # the direct API keeps delivering in place (deliver=True) and reports the status
    with db.connection() as conn:
        fired = rules_svc.evaluate_event(conn, {"id": "e2", "type": "person", "source": "alertstream", "severity": "info", "camera_id": None, "occurred_at": "2026-09-29T10:00:00Z", "details": {}}, "Asia/Jerusalem")
    assert fired[0]["ha_notify"] == {"mobile_app_phone": "sent"} and "_pending" not in fired[0]


def test_ha_state_event_notifies_after_commit(settings, monkeypatch):
    app = create_app(settings)
    db: Database = app.state.db
    with db.connection() as conn:
        conn.execute("INSERT INTO rules(id, name, trigger_json, scope_json, window_json, cooldown_s, actions_json, created_at, updated_at) VALUES "
                     "('r2', 'door', '{\"types\": [\"door\"]}', '{}', '{}', 0, '[{\"kind\": \"ha_notify\", \"service\": \"mobile_app_phone\"}]', '2026-09-29T00:00:00Z', '2026-09-29T00:00:00Z')")
    free: list[bool] = []
    monkeypatch.setattr(rules_svc, "HA_NOTIFY", lambda service, message, title: (free.append(lock_is_free(db)), "sent")[1])
    at = dt.datetime.now(dt.timezone.utc).isoformat()
    attrs = {"device_class": "door", "friendly_name": "Front door"}
    ha_sync.handle_state_event(db, {"entity_id": "binary_sensor.front_door", "old_state": {"entity_id": "binary_sensor.front_door", "state": "off", "attributes": attrs},
                                    "new_state": {"entity_id": "binary_sensor.front_door", "state": "on", "attributes": attrs, "last_changed": at, "last_updated": at}})
    assert free == [True]


def test_export_create_searches_the_nvr_without_the_write_lock(settings, monkeypatch):
    s = replace(settings, nvr_host="nvr.local", nvr_user="u", nvr_password="p")
    app = create_app(s)
    c = TestClient(app)
    recordings.invalidate()
    cam = c.post("/api/v1/cameras", json={"channel": 1, "alias": "a"}).json()
    set_track(s, cam["id"])
    search = fake_pages([("2026-09-14T10:00:00Z", "2026-09-14T10:02:00Z", "MOTION", "f1", 1000)])
    free: list[bool] = []

    def checked(*a, **kw):
        free.append(lock_is_free(app.state.db))
        return search(*a, **kw)

    monkeypatch.setattr(nvr, "search_recordings", checked)
    r = c.post("/api/v1/exports", json={"camera_id": cam["id"], "from_at": "2026-09-14T07:00:00Z", "to_at": "2026-09-14T07:10:00Z"})
    assert r.status_code == 201, r.text
    assert free and all(free)


def test_manual_recording_calls_the_nvr_without_the_write_lock(settings, monkeypatch):
    app = create_app(settings)
    db: Database = app.state.db
    free: list[tuple[str, bool]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        free.append((request.url.path.rsplit("/", 3)[-3], lock_is_free(db)))
        return httpx.Response(200, text="<ResponseStatus><statusCode>1</statusCode></ResponseStatus>")

    monkeypatch.setattr(nvr_write, "_client", lambda _s=None: httpx.Client(transport=httpx.MockTransport(handler), base_url="http://nvr"))
    c = TestClient(app)
    cam = c.post("/api/v1/cameras", json={"channel": 1, "alias": "a"}).json()
    with db.connection() as conn:
        conn.execute("UPDATE cameras SET main_track = 101 WHERE id = ?", (cam["id"],))
    assert c.post(f"/api/v1/cameras/{cam['id']}/record/start", json={"minutes": 5}).status_code == 201
    assert c.post(f"/api/v1/cameras/{cam['id']}/record/stop").status_code == 200
    c.post(f"/api/v1/cameras/{cam['id']}/record/start", json={"minutes": 1})
    with db.connection() as conn:
        conn.execute("UPDATE manual_recordings SET stop_at = '2000-01-01T00:00:00Z' WHERE stopped_at IS NULL")
    assert nvr_write.stop_expired_manual(db, settings) == 1
    assert free == [("start", True), ("stop", True), ("start", True), ("stop", True)]
    with db.connection(mode="read") as conn:
        actions = [r[0] for r in conn.execute("SELECT action FROM audit_log WHERE action LIKE 'nvr.record.%' ORDER BY id")]
    assert actions == ["nvr.record.start", "nvr.record.stop", "nvr.record.start", "nvr.record.stop"]


def test_assign_area_calls_the_bridge_without_the_write_lock(dev_app, monkeypatch):  # noqa: F811
    from smplwise.services import ha_bridge

    app, _s = dev_app
    c = TestClient(app)
    free: list[bool] = []

    phases: list[str] = []

    def fake_set_area(_settings, payload, timeout=15.0):
        free.append(lock_is_free(app.state.db))
        # two-phase: the attempt row is already committed - another connection sees it while HA is being asked
        probe = sqlite3.connect(app.state.db.path)
        try:
            row = probe.execute("SELECT details_json FROM audit_log WHERE action = 'devices.assign_area' ORDER BY id DESC LIMIT 1").fetchone()
        finally:
            probe.close()
        phases.append(json.loads(row[0])["phase"] if row else "none")
        return {"ok": True, "context_id": None, "request_id": payload["request_id"]}

    monkeypatch.setattr(ha_client, "call_bridge_set_area", fake_set_area)
    secret = c.get("/api/v1/ha/bridge/pairing").json()["pairing_code"]
    c.post("/api/v1/ha/bridge/ping", json=ha_bridge.sign(secret, {"version": "0.2.5"}))
    r = c.put("/api/v1/devices/entities/switch.loose/area", json={"area_id": "office"})
    assert r.status_code == 200, r.text
    assert free == [True] and phases == ["attempt"]
    with app.state.db.connection(mode="read") as conn:
        rows = [json.loads(x[0]) for x in conn.execute("SELECT details_json FROM audit_log WHERE action = 'devices.assign_area' ORDER BY id")]
    assert [x["phase"] for x in rows] == ["attempt", "outcome"] and rows[0]["request"] == rows[1]["request"]


def test_retry_locked_retries_busy_only(monkeypatch):
    monkeypatch.setattr(time, "sleep", lambda _s: None)
    calls = {"n": 0}

    def flaky():
        calls["n"] += 1
        if calls["n"] < 3:
            raise sqlite3.OperationalError("database is locked")
        return "ok"

    assert retry_locked(flaky, attempts=3) == "ok" and calls["n"] == 3
    with pytest.raises(sqlite3.OperationalError, match="no such table"):
        retry_locked(lambda: (_ for _ in ()).throw(sqlite3.OperationalError("no such table: x")))
    calls["n"] = -10
    with pytest.raises(sqlite3.OperationalError, match="locked"):
        retry_locked(flaky, attempts=2)


def test_busy_failure_names_the_holder_and_slow_holds_are_logged(tmp_path, monkeypatch, caplog):
    monkeypatch.setattr(db_mod, "BUSY_TIMEOUT_S", 0.2)
    monkeypatch.setattr(db_mod, "SLOW_HOLD_S", 0.3)
    db = Database(tmp_path / "t.db")
    db.migrate()
    holding, done = threading.Event(), threading.Event()

    def hold() -> None:
        with db.connection(label="slow holder"):
            holding.set()
            done.wait(5)

    t = threading.Thread(target=hold)
    t.start()
    holding.wait(5)
    before = db_mod.lock_stats()
    with caplog.at_level(logging.WARNING, logger="smplwise.db"):
        with pytest.raises(sqlite3.OperationalError, match="locked"):
            with db.connection(label="victim"):
                pass
        time.sleep(0.2)
        done.set()
        t.join(5)
    after = db_mod.lock_stats()
    assert after["busy_errors"] == before["busy_errors"] + 1
    assert after["last_busy"]["waiter"] == "victim" and after["last_busy"]["holder"] == "slow holder"
    assert any("held by slow holder" in r.getMessage() for r in caplog.records)
    assert any("write lock held" in r.getMessage() and "slow holder" in r.getMessage() for r in caplog.records)
    assert after["slow_holds"] >= before["slow_holds"] + 1


def test_connection_settings_and_idle_checkpoint(tmp_path):
    db = Database(tmp_path / "t.db")
    db.migrate()
    with db.connection() as conn:
        assert conn.execute("PRAGMA journal_mode").fetchone()[0] == "wal"
        assert conn.execute("PRAGMA synchronous").fetchone()[0] == 2  # FULL: a committed audit row survives a power cut
        assert conn.execute("PRAGMA busy_timeout").fetchone()[0] == 10000
        conn.execute("INSERT INTO settings(key, value) VALUES ('k', 'v')")
    out = db.checkpoint()
    assert out["mode"] == "PASSIVE" and out["busy"] is False


def test_health_reports_write_lock_counters(client):
    body = client.get("/api/v1/health").json()
    assert {"holds", "slow_holds", "max_hold_s", "busy_errors", "max_hold_by", "last_busy"} <= set(body["db"]["write_lock"])
    # who held the lock (request paths with other users' ids) only for a system.configure holder; counters for everyone
    other = client.get("/api/v1/health", headers=as_user("viewer1")).json()["db"]["write_lock"]
    assert {"holds", "slow_holds", "max_hold_s", "busy_errors"} <= set(other) and "max_hold_by" not in other and "last_busy" not in other


def test_audit_row_of_a_refusal_survives_release(client):
    """An expected API error still commits its audit row (the dependency's ApiError path), with commit-before-send in place."""
    client.get("/api/v1/me")  # the bootstrap administrator exists first
    r = client.put("/api/v1/devices/entities/switch.x/area", json={"area_id": "office"}, headers=as_user("nobody"))
    assert r.status_code == 403
    db: Database = client.app.state.db
    with db.connection(mode="read") as conn:
        row = conn.execute("SELECT actor_username, decision FROM audit_log ORDER BY id DESC LIMIT 1").fetchone()
    assert (row["actor_username"], row["decision"]) == ("nobody", "denied")


# ---------------------------------------------------------------- review round 1 (races, two-phase device calls, deadlines)

def _export_lab(settings):
    s = replace(settings, nvr_host="nvr.local", nvr_user="u", nvr_password="p")
    app = create_app(s)
    c = TestClient(app)
    recordings.invalidate()
    cam = c.post("/api/v1/cameras", json={"channel": 1, "alias": "a"}).json()
    set_track(s, cam["id"])
    fast = fake_pages([("2026-09-14T10:00:00Z", "2026-09-14T10:02:00Z", "MOTION", "f1", 1000)])

    def slow(*a, **kw):
        time.sleep(0.6)
        return fast(*a, **kw)

    return app, c, cam, fast, slow


def _concurrently(*calls):
    """Start each call 0.2 s after the previous one (the second passes its early check while the first searches)."""
    out: list = [None] * len(calls)

    def run(i, fn):
        out[i] = fn()

    threads = []
    for i, fn in enumerate(calls):
        t = threading.Thread(target=run, args=(i, fn))
        t.start()
        threads.append(t)
        time.sleep(0.2)
    for t in threads:
        t.join(30)
    return out


def test_concurrent_export_creates_respect_the_quota(settings, monkeypatch):
    app, c, cam, fast, slow = _export_lab(settings)
    body = {"camera_id": cam["id"], "from_at": "2026-09-14T07:00:00Z", "to_at": "2026-09-14T07:10:00Z"}
    monkeypatch.setattr(nvr, "search_recordings", fast)
    for _ in range(4):
        assert c.post("/api/v1/exports", json=body).status_code == 201
    monkeypatch.setattr(nvr, "search_recordings", slow)
    recordings.invalidate()
    c1, c2 = TestClient(app), TestClient(app)
    r1, r2 = _concurrently(lambda: c1.post("/api/v1/exports", json=body), lambda: c2.post("/api/v1/exports", json=body))
    assert sorted([r1.status_code, r2.status_code]) == [201, 429], (r1.text, r2.text)
    with app.state.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM export_jobs WHERE state = 'queued'").fetchone()[0] == 5


def test_concurrent_preserve_creates_one_job(settings, monkeypatch):
    app, c, cam, fast, slow = _export_lab(settings)
    seed_tree(c)
    case = c.post("/api/v1/cases", json={"title": "t"}).json()
    item = c.post(f"/api/v1/cases/{case['id']}/items", json={"kind": "clip", "camera_id": cam["id"], "from_at": "2026-09-14T07:00:00Z", "to_at": "2026-09-14T07:05:00Z"}).json()
    monkeypatch.setattr(nvr, "search_recordings", slow)
    url = f"/api/v1/cases/{case['id']}/items/{item['id']}/preserve"
    c1, c2 = TestClient(app), TestClient(app)
    r1, r2 = _concurrently(lambda: c1.post(url), lambda: c2.post(url))
    assert sorted([r1.status_code, r2.status_code]) == [201, 409], (r1.text, r2.text)
    assert "already_preserving" in (r1.text + r2.text)
    with app.state.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM export_jobs").fetchone()[0] == 1, "no orphaned second job"


def _record_lab(settings, monkeypatch, handler):
    app = create_app(settings)
    db: Database = app.state.db
    monkeypatch.setattr(nvr_write, "_client", lambda _s=None: httpx.Client(transport=httpx.MockTransport(handler), base_url="http://nvr"))
    c = TestClient(app, raise_server_exceptions=False)
    cam = c.post("/api/v1/cameras", json={"channel": 1, "alias": "a"}).json()
    with db.connection() as conn:
        conn.execute("UPDATE cameras SET main_track = 101 WHERE id = ?", (cam["id"],))
    return app, db, c, cam


def test_manual_start_when_the_database_stays_busy_stops_the_recording_and_keeps_the_row(settings, monkeypatch):
    """The NVR started recording, then the request cannot take the lock again (busy past the retries): the recording is
    stopped again, and the row + attempt audit row committed before the call remain for the janitor."""
    calls: list[str] = []
    holding, done = threading.Event(), threading.Event()
    box: dict = {}

    def hold() -> None:
        h = sqlite3.connect(box["db"].path, isolation_level=None)
        h.execute("BEGIN IMMEDIATE")
        holding.set()
        done.wait(10)
        h.execute("ROLLBACK")
        h.close()

    def handler(request: httpx.Request) -> httpx.Response:
        kind = request.url.path.rsplit("/", 3)[-3]
        calls.append(kind)
        if kind == "start" and not holding.is_set():
            threading.Thread(target=hold, daemon=True).start()
            holding.wait(5)
        return httpx.Response(200, text="<ResponseStatus><statusCode>1</statusCode></ResponseStatus>")

    app, db, c, cam = _record_lab(settings, monkeypatch, handler)
    box["db"] = db
    monkeypatch.setattr(db_mod, "BUSY_TIMEOUT_S", 0.2)
    monkeypatch.setattr(time, "sleep", lambda _s: None)
    try:
        r = c.post(f"/api/v1/cameras/{cam['id']}/record/start", json={"minutes": 5})
    finally:
        done.set()
    assert r.status_code == 500
    assert calls == ["start", "stop"], "the unconfirmed recording is stopped again"
    with db.connection(mode="read") as conn:
        rows = conn.execute("SELECT stopped_at FROM manual_recordings").fetchall()
        audits = [json.loads(x[0])["phase"] for x in conn.execute("SELECT details_json FROM audit_log WHERE action = 'nvr.record.start'")]
    assert len(rows) == 1 and rows[0]["stopped_at"] is None and audits == ["attempt"]
    with db.connection() as conn:
        conn.execute("UPDATE manual_recordings SET stop_at = '2000-01-01T00:00:00Z'")
    assert nvr_write.stop_expired_manual(db, settings) == 1, "the janitor closes it"


def test_manual_start_refused_by_the_nvr_closes_its_row(settings, monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(403, text="<ResponseStatus><statusCode>4</statusCode><subStatusCode>noPermission</subStatusCode></ResponseStatus>")

    app, db, c, cam = _record_lab(settings, monkeypatch, handler)
    r = c.post(f"/api/v1/cameras/{cam['id']}/record/start", json={"minutes": 5})
    assert r.status_code == 503 and r.json()["code"] == "source_forbidden"
    assert c.get(f"/api/v1/cameras/{cam['id']}/record").json()["active"] is None
    with db.connection(mode="read") as conn:
        row = conn.execute("SELECT stop_reason FROM manual_recordings").fetchone()
        audits = [(x["decision"], json.loads(x["details_json"])["phase"]) for x in conn.execute("SELECT decision, details_json FROM audit_log WHERE action = 'nvr.record.start' ORDER BY id")]
    assert row["stop_reason"] == "start_failed:source_forbidden" and audits == [("allowed", "attempt"), ("denied", "outcome")]


def test_note_busy_survives_concurrent_holder_changes(monkeypatch):
    silent = logging.getLogger("smplwise.test.silent")
    silent.disabled = True
    monkeypatch.setattr(db_mod, "log", silent)
    stop = threading.Event()
    keys = [-(i + 1) for i in range(200)]

    def churn() -> None:
        while not stop.is_set():
            for k in keys:
                db_mod._holders[k] = ("churn", time.monotonic())
            for k in keys:
                db_mod._holders.pop(k, None)

    t = threading.Thread(target=churn, daemon=True)
    t.start()
    try:
        for _ in range(3000):
            db_mod._note_busy("waiter")
    finally:
        stop.set()
        t.join(5)
        for k in keys:
            db_mod._holders.pop(k, None)


def test_ha_state_event_gives_up_within_the_busy_deadline(tmp_path, monkeypatch):
    """Runs inside the HA WebSocket loop: one attempt bounded by the busy timeout, never ~30 s of retries."""
    monkeypatch.setattr(db_mod, "BUSY_TIMEOUT_S", 0.3)
    db = Database(tmp_path / "t.db")
    db.migrate()
    holder = sqlite3.connect(db.path, isolation_level=None)
    holder.execute("BEGIN IMMEDIATE")
    try:
        started = time.monotonic()
        with pytest.raises(sqlite3.OperationalError, match="locked"):
            ha_sync.handle_state_event(db, {"entity_id": "sensor.x", "old_state": None, "new_state": {"entity_id": "sensor.x", "state": "1", "attributes": {}}})
        assert time.monotonic() - started < 0.9
    finally:
        holder.execute("ROLLBACK")
        holder.close()


def test_released_connection_refuses_further_writes(tmp_path):
    db = Database(tmp_path / "t.db")
    db.migrate()
    with db.connection() as conn:
        conn.execute("INSERT INTO settings(key, value) VALUES ('a', '1')")
        db_mod.release(conn)
        with pytest.raises(sqlite3.OperationalError, match="readonly"):
            conn.execute("INSERT INTO settings(key, value) VALUES ('b', '2')")
    with db.connection(mode="read") as conn:
        assert [r[0] for r in conn.execute("SELECT key FROM settings WHERE key IN ('a', 'b')")] == ["a"]


def test_uploads_are_decoded_and_rendered_without_the_write_lock(client, monkeypatch):
    """A plan upload (DXF / image render, PDF page count, hash) and a site / building picture (decode + re-encode) take
    seconds on the add-on's CPU; they ran under the request's write lock, on the event loop (2026-09-29 inventory)."""
    from smplwise.routers import catalog as catalog_router
    from smplwise.services import plan_render

    db: Database = client.app.state.db
    ids = seed_tree(client)
    seen: list[bool] = []
    real_normalize, real_store = plan_render.normalize_image, catalog_router._store_image

    def normalize(*a, **kw):
        seen.append(lock_is_free(db))
        return real_normalize(*a, **kw)

    def store(*a, **kw):
        seen.append(lock_is_free(db))
        return real_store(*a, **kw)

    monkeypatch.setattr(plan_render, "normalize_image", normalize)
    monkeypatch.setattr(catalog_router, "_store_image", store)
    r = client.post(f"/api/v1/floors/{ids['floor2']}/plan-assets", files={"file": ("p.png", png_bytes(), "image/png")})
    assert r.status_code == 201, r.text
    r = client.post(f"/api/v1/sites/{ids['site']}/image", files={"file": ("s.png", png_bytes(), "image/png")})
    assert r.status_code == 200, r.text
    assert seen == [True, True]
    with db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action IN ('plan.asset.upload', 'site.update')").fetchone()[0] == 2


def test_an_upload_waiting_to_relock_never_blocks_the_event_loop(settings, monkeypatch):
    """Review B2: the uploads' re-lock after the render queues behind other writers; it must wait in the threadpool,
    not on the event loop (an async handler froze every stream and WebSocket until the holder let go)."""
    from smplwise.services import plan_render

    app = create_app(settings)
    db: Database = app.state.db
    real_normalize = plan_render.normalize_image
    holding, release_holder = threading.Event(), threading.Event()

    def hold() -> None:
        with db.connection(label="long writer"):
            holding.set()
            release_holder.wait(10)

    def normalize(*a, **kw):
        threading.Thread(target=hold, daemon=True).start()  # another writer takes the lock while the render runs
        holding.wait(5)
        return real_normalize(*a, **kw)

    monkeypatch.setattr(plan_render, "normalize_image", normalize)
    with TestClient(app) as c:  # one portal: every request below runs on the same event loop
        ids = seed_tree(c)
        c.get("/healthz")  # warm-up: FastAPI builds its route table lazily on the first requests (seconds of loop CPU)
        result: dict[str, Any] = {}

        def upload() -> None:
            result["r"] = c.post(f"/api/v1/floors/{ids['floor2']}/plan-assets", files={"file": ("p.png", png_bytes(), "image/png")})

        t = threading.Thread(target=upload)
        t.start()
        assert holding.wait(10)
        time.sleep(0.3)  # the upload is now waiting to take the lock back
        started = time.monotonic()
        assert c.get("/healthz").status_code == 200
        assert time.monotonic() - started < 1.0
        release_holder.set()
        t.join(20)
    assert result["r"].status_code == 201, result["r"].text


def test_a_site_deleted_while_its_picture_decodes_leaves_no_file(client, monkeypatch):
    from smplwise.routers import catalog as catalog_router

    ids = seed_tree(client)
    real_store = catalog_router._store_image
    written: list[str] = []

    def store(request, kind, obj_id, file):
        rel = real_store(request, kind, obj_id, file)
        written.append(rel)
        with client.app.state.db.connection() as w:  # deleted meanwhile (the lock is free during the decode)
            w.execute("UPDATE sites SET deleted_at = ? WHERE id = ?", (db_mod.now_iso(), obj_id))
        return rel

    monkeypatch.setattr(catalog_router, "_store_image", store)
    r = client.post(f"/api/v1/sites/{ids['site']}/image", files={"file": ("s.png", png_bytes(), "image/png")})
    assert r.status_code == 404, r.text
    assert written and not (client.app.state.settings.data_dir / "catalog_images" / written[0]).exists()
