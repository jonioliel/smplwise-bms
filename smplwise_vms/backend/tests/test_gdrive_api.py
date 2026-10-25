"""GDRIVEBK-295: the Google Drive backup settings API against the fake Drive (no network, no real Google account): off by default,
the settings schema with validation and audit, the write-only client secret, the consent flow as a 501 TODO (and, through an
injected fake flow, connect -> sealed refresh token -> connection test -> disconnect with revoke), a revoked token seen by the test,
the push through the runtime, administrators only, and nothing of it in a project backup."""
from __future__ import annotations

import json
import os

import httpx
import pytest
from conftest import as_user, bind, seed_tree
from fake_gdrive import CLIENT_ID, REFRESH_TOKEN, FakeDrive
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import backup as backup_svc
from smplwise.services import gdrive_runtime as rt
from smplwise.services.offbox_gdrive import DeviceAuthorization, PollResult

URL = "/api/v1/backups/gdrive"
CLIENT_SECRET_VALUE = "GOCSPX-fake-client-secret-value"


class FakeFlow:
    """Stands in for TODO(GDRIVEBK-OAUTH): the first poll is pending, the second hands over the refresh token."""

    def __init__(self) -> None:
        self.polls = 0

    def start(self, client_id: str, scope: str) -> DeviceAuthorization:
        assert client_id == CLIENT_ID and scope.endswith("/auth/drive.file")
        return DeviceAuthorization("ABCD-EFGH", "https://www.google.com/device", 900, 5, "device-code-secret")

    def poll(self, client_id: str, auth: DeviceAuthorization) -> PollResult:
        self.polls += 1
        return PollResult("pending") if self.polls == 1 else PollResult("connected", REFRESH_TOKEN)


@pytest.fixture()
def world(settings, monkeypatch):
    drive = FakeDrive()
    monkeypatch.setattr(rt, "HTTP_TRANSPORT", httpx.MockTransport(drive.handler))
    monkeypatch.setattr(rt, "SLEEP", lambda s: None)
    rt._PENDING.clear()
    app = create_app(settings)
    c = TestClient(app)
    seed_tree(c)
    yield type("W", (), {"app": app, "c": c, "drive": drive, "settings": settings, "db": app.state.db})
    rt._PENDING.clear()
    assert drive.foreign == [], "a request left the fake Drive"


def _enable(w, **over):
    body = {"enabled": True, "client_id": CLIENT_ID, **over}
    r = w.c.put(f"{URL}/settings", json=body)
    assert r.status_code == 200, r.text
    return r.json()


def _connect(w, monkeypatch):
    monkeypatch.setattr(rt, "OAUTH_FLOW", FakeFlow())
    start = w.c.post(f"{URL}/connect/start")
    assert start.status_code == 200, start.text
    assert start.json()["user_code"] == "ABCD-EFGH" and "device_code" not in start.text and "device-code-secret" not in start.text
    assert w.c.post(f"{URL}/connect/poll").json() == {"state": "pending"}
    assert w.c.post(f"{URL}/connect/poll").json() == {"state": "connected"}


def _db_text(w) -> str:
    with w.db.connection(mode="read") as conn:
        rows = [dict(r) for r in conn.execute("SELECT * FROM app_secrets").fetchall()]
        rows += [dict(r) for r in conn.execute("SELECT key, value FROM settings WHERE key LIKE 'backup.gdrive.%'").fetchall()]
        rows += [dict(r) for r in conn.execute("SELECT action, details_json, reason FROM audit_log WHERE action LIKE 'backup.gdrive.%'").fetchall()]
    return json.dumps(rows, default=str)


def test_off_by_default_and_nothing_runs_while_off(world):
    w = world
    s = w.c.get(URL).json()
    assert s["settings"]["enabled"] is False and s["connected"] is False and s["oauth_available"] is False
    assert s["scope"] == "https://www.googleapis.com/auth/drive.file" and s["pending_authorization"] is None
    for path in ("test", "connect/start"):
        r = w.c.post(f"{URL}/{path}")
        assert r.status_code == 409 and r.json()["code"] == "gdrive_disabled", path
    assert w.drive.calls == []  # nothing reached even the fake


def test_settings_are_validated_saved_and_audited_with_a_write_only_client_secret(world):
    w = world
    s = _enable(w, retention={"keep_last": 5, "keep_daily": 7, "keep_weekly": 2, "keep_monthly": 1}, chunk_mib=16, prune_mode="trash",
                client_secret=CLIENT_SECRET_VALUE)
    assert s["settings"]["enabled"] is True and s["settings"]["retention"]["keep_last"] == 5 and s["settings"]["chunk_mib"] == 16
    assert s["client_secret_configured"] is True and "client_secret" not in s["settings"]
    assert CLIENT_SECRET_VALUE not in json.dumps(s) and CLIENT_SECRET_VALUE not in _db_text(w)
    for bad in ({"client_id": "nope"}, {"max_retries": 99}, {"unknown": 1}, {"retention": {"keep_last": 0}}, {"verify": "none"}):
        r = w.c.put(f"{URL}/settings", json={"enabled": True, "client_id": CLIENT_ID, **bad})
        assert r.status_code == 422, (bad, r.status_code)
    assert w.c.get(URL).json()["settings"]["chunk_mib"] == 16  # refusals changed nothing
    off = w.c.put(f"{URL}/settings", json={"enabled": False, "client_secret": ""}).json()
    assert off["client_secret_configured"] is False and off["settings"]["chunk_mib"] == 8  # a PUT replaces the whole configuration
    with w.db.connection(mode="read") as conn:
        details = [json.loads(r[0] or "{}") for r in conn.execute("SELECT details_json FROM audit_log WHERE action = 'backup.gdrive.settings_update'")]
    assert details[0]["client_secret"] == "set" and "retention" in details[0]["changed"] and details[-1]["client_secret"] == "cleared"


def test_connect_is_a_501_todo_until_the_consent_flow_exists(world):
    w = world
    assert w.c.post(f"{URL}/connect/start").json()["code"] == "gdrive_disabled"
    w.c.put(f"{URL}/settings", json={"enabled": True})
    assert w.c.post(f"{URL}/connect/start").json()["code"] == "gdrive_client_missing"
    _enable(w)
    r = w.c.post(f"{URL}/connect/start")
    assert r.status_code == 501 and r.json()["code"] == "gdrive_oauth_not_implemented"
    assert w.c.post(f"{URL}/connect/poll").json() == {"state": "expired"}
    assert w.drive.calls == []


def test_connect_test_and_disconnect_with_a_fake_flow(world, monkeypatch):
    w = world
    _enable(w)
    r = w.c.post(f"{URL}/test")
    assert r.status_code == 200 and r.json()["error"] == "gdrive_not_connected"
    _connect(w, monkeypatch)
    s = w.c.get(URL).json()
    assert s["connected"] is True and s["state"]["connected_by"] and REFRESH_TOKEN not in json.dumps(s)
    assert REFRESH_TOKEN not in _db_text(w)
    t = w.c.post(f"{URL}/test").json()
    assert t["ok"] is True and t["steps"] == ["write", "read", "delete", "list"] and t["objects"] == 0
    s = w.c.get(URL).json()
    assert s["state"]["folder_id"] and s["state"]["last_test"]["ok"] is True
    assert [f.name for f in w.drive.files.values()] == ["SmplWise Arx backups"]  # the marker is gone, the folder stays
    assert w.c.post(f"{URL}/disconnect", json={}).json()["code"] == "confirm_required"
    d = w.c.post(f"{URL}/disconnect", json={"confirm": "DISCONNECT"}).json()
    assert d == {"disconnected": True, "had_token": True, "revoked": True} and w.drive.revoke_calls == ["token"]
    s = w.c.get(URL).json()
    assert s["connected"] is False and s["state"]["folder_id"] and s["state"].get("connected_at") is None
    with w.db.connection(mode="read") as conn:
        actions = [r[0] for r in conn.execute("SELECT action FROM audit_log WHERE action LIKE 'backup.gdrive.%' ORDER BY rowid")]
    assert {"backup.gdrive.connect_start", "backup.gdrive.connect", "backup.gdrive.test", "backup.gdrive.disconnect"} <= set(actions)


def test_a_revoked_token_and_a_push_through_the_runtime(world, monkeypatch, tmp_path):
    w = world
    _enable(w, retention={"keep_last": 1, "keep_daily": 0, "keep_weekly": 0, "keep_monthly": 0})
    _connect(w, monkeypatch)
    archives = []
    for day in (20, 21):
        p = backup_svc.backups_dir(w.settings) / f"daily-202610{day}-030000.zip"
        p.write_bytes(os.urandom(300 * 1024))
        archives.append(p)
    for p in archives:
        r = rt.run_push(w.db, w.settings, p)
        assert r["ok"] and r["verified"], r
    assert r["deleted"] == ["daily-20261020-030000.zip.swxb"]
    assert w.c.get(URL).json()["state"]["last_push"]["deleted_count"] == 1
    w.drive.revoked = True
    t = w.c.post(f"{URL}/test").json()
    assert t["ok"] is False and t["error"] == "gdrive_reconnect_required"
    last = w.c.get(URL).json()["state"]["last_test"]
    assert last["ok"] is False and last["error"] == "gdrive_reconnect_required" and last["at"]


def test_only_system_administrators(world):
    w = world
    ids = seed_tree(w.c)
    bind(w.c, w.settings, "ron", "site_admin", "site", ids["site"])
    h = as_user("ron")
    calls = [("GET", URL, None), ("PUT", f"{URL}/settings", {"enabled": True}), ("POST", f"{URL}/connect/start", None),
             ("POST", f"{URL}/connect/poll", None), ("POST", f"{URL}/disconnect", {"confirm": "DISCONNECT"}), ("POST", f"{URL}/test", None)]
    for method, url, body in calls:
        resp = w.c.request(method, url, headers=h, **({"json": body} if body is not None else {}))
        assert resp.status_code == 403, (method, url, resp.status_code)
    assert w.c.get(URL).json()["settings"]["enabled"] is False


def test_the_drive_connection_never_travels_in_a_project_backup(world):
    w = world
    _enable(w)
    assert backup_svc._kept_setting(rt.CONFIG_KEY) and backup_svc._kept_setting(rt.STATE_KEY)
    assert "app_secrets" not in set(backup_svc.PROJECT_TABLES + backup_svc.ACCESS_TABLES)
