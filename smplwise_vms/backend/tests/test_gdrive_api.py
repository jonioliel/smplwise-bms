"""GDRIVEBK-2310: a Google Drive off-box target through the shared targets API and runtime, against the fake Drive (no network, no
real Google account): created OFF with a write-only sealed client secret, the refresh token never typed, switched on only once an
account is connected; the device-flow consent (pending, slow_down, early polls not forwarded, connected -> the refresh token sealed,
denied / expired); the connection test, the push (the copy in Drive is SWXB ciphertext), the copies listing and the restore drill of the
newest Drive copy; quota / reconnect / rate-limit failures as clear Hebrew statuses (API messages and the daily alert); a client-id change
drops the token; disconnect revokes; migration 0186 keeps every existing row; administrators only; nothing of it in a project backup."""
from __future__ import annotations

import json
import sqlite3
from pathlib import Path

import httpx
import pytest
from conftest import as_user, bind, seed_tree
from fake_gdrive import CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN, USER_CODE, FakeDrive
from fastapi.testclient import TestClient

from smplwise.db import MIGRATIONS_DIR
from smplwise.main import create_app
from smplwise.services import backup as backup_svc
from smplwise.services import backup_drill as drill
from smplwise.services import offbox_gdrive, offbox_gdrive_connect, offbox_runtime

URL = "/api/v1/backups/offbox"


@pytest.fixture()
def world(settings, monkeypatch):
    drive = FakeDrive()
    monkeypatch.setattr(offbox_runtime, "GDRIVE_HTTP", lambda: httpx.Client(transport=httpx.MockTransport(drive.handler)))
    monkeypatch.setattr(offbox_gdrive, "SLEEP", lambda s: None)
    clock = [1000.0]
    monkeypatch.setattr(offbox_gdrive_connect, "CLOCK", lambda: clock[0])
    offbox_gdrive_connect._PENDING.clear()
    app = create_app(settings)
    c = TestClient(app)
    seed_tree(c)
    yield type("W", (), {"app": app, "c": c, "drive": drive, "settings": settings, "db": app.state.db, "clock": clock})
    offbox_gdrive_connect._PENDING.clear()
    assert drive.foreign == [], "a request left the fake Drive"


def _body(**over):
    body = {"name": "Google Drive", "kind": "gdrive", "enabled": False,
            "config": {"client_id": CLIENT_ID, "folder_name": "SmplWise Arx backups", "chunk_mib": 1, "prune_mode": "delete"},
            "secrets": {"client_secret": CLIENT_SECRET}, "retention": {"keep_last": 2, "keep_daily": 0, "keep_weekly": 0, "keep_monthly": 0}}
    body.update(over)
    return body


def _create(w, **over) -> dict:
    r = w.c.post(f"{URL}/targets", json=_body(**over))
    assert r.status_code == 201, r.text
    return r.json()


def _connect(w, tid: str) -> None:
    start = w.c.post(f"{URL}/targets/{tid}/gdrive/connect")
    assert start.status_code == 200, start.text
    assert start.json() == {"user_code": USER_CODE, "verification_url": "https://www.google.com/device", "expires_in": 1800, "interval": 5}
    w.drive.device_script = ["pending", "slow_down", "approve"]
    assert w.c.post(f"{URL}/targets/{tid}/gdrive/poll").json() == {"state": "pending", "interval": 5}
    calls = len(w.drive.calls)
    assert w.c.post(f"{URL}/targets/{tid}/gdrive/poll").json()["state"] == "pending"  # too early: Google is not asked
    assert len(w.drive.calls) == calls
    w.clock[0] += 5
    assert w.c.post(f"{URL}/targets/{tid}/gdrive/poll").json() == {"state": "slow_down", "interval": 10}
    w.clock[0] += 10
    assert w.c.post(f"{URL}/targets/{tid}/gdrive/poll").json() == {"state": "connected"}


def _backup(w) -> str:
    r = w.c.post("/api/v1/backups", json={"note": "gdrive"})
    assert r.status_code == 201, r.text
    return r.json()["name"]


def _db_text(w) -> str:
    with w.db.connection(mode="read") as conn:
        rows = [dict(r) for r in conn.execute("SELECT * FROM backup_offbox_secrets").fetchall()]
        rows += [dict(r) for r in conn.execute("SELECT * FROM backup_offbox_targets").fetchall()]
        rows += [dict(r) for r in conn.execute("SELECT * FROM backup_offbox_runs").fetchall()]
        rows += [dict(r) for r in conn.execute("SELECT action, details_json, reason FROM audit_log WHERE action LIKE 'backup.offbox.%'").fetchall()]
    return json.dumps(rows, default=str)


def test_created_off_with_a_sealed_client_secret_and_switched_on_only_when_connected(world):
    w = world
    t = _create(w)
    assert t["kind"] == "gdrive" and t["enabled"] is False
    assert t["secrets"] == {"client_secret": True, "refresh_token": False} and t["gdrive"]["connected"] is False
    assert "client_secret" not in t["config"] and CLIENT_SECRET not in json.dumps(t)
    assert w.c.get(URL).json()["transports"]["gdrive"] is True
    # the refresh token is never typed or pasted; an enabled target needs a connected account
    typed = w.c.post(f"{URL}/targets", json=_body(secrets={"client_secret": CLIENT_SECRET, "refresh_token": "1//pasted"}))
    assert typed.status_code == 422 and typed.json()["code"] == "gdrive_token_via_connect"
    on = w.c.patch(f"{URL}/targets/{t['id']}", json={"enabled": True})
    assert on.status_code == 422 and on.json()["code"] == "gdrive_not_connected" and "Google" in on.json()["user_message"]
    assert w.c.post(f"{URL}/targets", json=_body(enabled=True)).json()["code"] == "gdrive_not_connected"
    bad = w.c.post(f"{URL}/targets", json=_body(config={"client_id": "nope"}))
    assert bad.status_code == 422 and bad.json()["code"] == "destination_invalid"
    assert w.c.post(f"{URL}/targets", json=_body(config={"client_id": CLIENT_ID, "folder_name": "a'b"})).json()["code"] == "destination_invalid"
    assert w.c.post(f"{URL}/targets", json=_body(config={"client_id": CLIENT_ID, "chunk_mib": "x"})).json()["code"] == "destination_invalid"
    assert w.drive.calls == [], "saving a target never calls Google"
    # the consent
    _connect(w, t["id"])
    view = w.c.get(URL).json()["targets"][0]
    assert view["secrets"] == {"client_secret": True, "refresh_token": True} and view["gdrive"]["connected"] is True
    assert view["gdrive"]["pending"] is False and view["enabled"] is False, "connecting never switches the target on by itself"
    on = w.c.patch(f"{URL}/targets/{t['id']}", json={"enabled": True})
    assert on.status_code == 200 and on.json()["enabled"] is True
    text = _db_text(w)
    assert REFRESH_TOKEN not in text and CLIENT_SECRET not in text and "AH-fake-device-code" not in text
    assert "store:offbox." in text and "backup.offbox.gdrive_connect" in text
    with w.db.connection(mode="read") as conn:
        fields = sorted(r[0] for r in conn.execute("SELECT field FROM backup_offbox_secrets WHERE target_id = ?", (t["id"],)).fetchall())
    assert fields == ["client_secret", "refresh_token"]


def test_consent_denied_expired_and_bad_client(world):
    w = world
    t = _create(w)
    assert w.c.post(f"{URL}/targets/{t['id']}/gdrive/poll").json() == {"state": "none"}
    w.c.post(f"{URL}/targets/{t['id']}/gdrive/connect")
    assert w.c.get(URL).json()["targets"][0]["gdrive"]["pending"] is True
    w.drive.device_script = ["deny"]
    assert w.c.post(f"{URL}/targets/{t['id']}/gdrive/poll").json() == {"state": "denied"}
    assert w.c.post(f"{URL}/targets/{t['id']}/gdrive/poll").json() == {"state": "none"}
    w.c.post(f"{URL}/targets/{t['id']}/gdrive/connect")
    w.clock[0] += 1801
    assert w.c.post(f"{URL}/targets/{t['id']}/gdrive/poll").json() == {"state": "expired"}
    # a wrong client secret: a clear status, nothing sealed
    w.c.put(f"{URL}/targets/{t['id']}", json=_body(secrets={"client_secret": "wrong"}))
    w.c.post(f"{URL}/targets/{t['id']}/gdrive/connect")
    r = w.c.post(f"{URL}/targets/{t['id']}/gdrive/poll")
    assert r.status_code == 422 and r.json()["code"] == "gdrive_client_invalid" and "Client" in r.json()["user_message"]
    assert w.c.get(URL).json()["targets"][0]["secrets"]["refresh_token"] is False
    # no client secret at all
    w.c.put(f"{URL}/targets/{t['id']}", json=_body(secrets={"client_secret": ""}))
    r = w.c.post(f"{URL}/targets/{t['id']}/gdrive/connect")
    assert r.status_code == 422 and r.json()["code"] == "gdrive_client_missing"
    # the routes exist only for Google Drive targets
    s3ish = w.c.post(f"{URL}/targets", json={"name": "USB", "kind": "local", "enabled": False, "config": {"path": str(Path(w.settings.data_dir).parent / "usb")}})
    assert w.c.post(f"{URL}/targets/{s3ish.json()['id']}/gdrive/connect").status_code == 404


def test_test_push_copies_and_drill_through_the_shared_pipeline(world):
    w = world
    t = _create(w)
    _connect(w, t["id"])
    w.c.patch(f"{URL}/targets/{t['id']}", json={"enabled": True})
    test = w.c.post(f"{URL}/targets/{t['id']}/test")
    assert test.status_code == 200 and test.json()["ok"] is True, test.text
    name = _backup(w)
    res = offbox_runtime.after_backup(w.db, w.settings, name)
    assert res[0]["ok"] and res[0]["verified"], res
    stored = [f for f in w.drive.files.values() if f.name.endswith(".zip.swxb")]
    assert len(stored) == 1 and stored[0].data.startswith(b"SWXB\x01")
    plain = (backup_svc.backups_dir(w.settings) / name).read_bytes()
    assert plain[:2048] not in stored[0].data, "only the encrypted archive leaves the box"
    folder = next(f for f in w.drive.files.values() if f.mime == "application/vnd.google-apps.folder")
    assert folder.name == "SmplWise Arx backups" and stored[0].parents == [folder.id]
    copies = w.c.get(f"{URL}/targets/{t['id']}/copies").json()["copies"]
    assert [c["name"] for c in copies] == [stored[0].name]
    r = drill.run_offbox_drill(w.db, w.settings, t["id"])
    assert r["result"] == "PASS", [c for c in r["checks"] if not c["ok"]]
    # retention through Drive: keep_last 2 -> the third push deletes the oldest copy
    for _ in range(2):
        _backup(w)
        assert offbox_runtime.run_push(w.db, w.settings, t["id"], trigger="manual")["ok"]
    assert len([f for f in w.drive.files.values() if f.name.endswith(".zip.swxb")]) == 2


def test_failures_surface_as_clear_hebrew_statuses(world):
    w = world
    t = _create(w)
    _connect(w, t["id"])
    w.c.patch(f"{URL}/targets/{t['id']}", json={"enabled": True})
    name = _backup(w)

    def alert() -> list[str]:
        with w.db.connection(mode="read") as conn:
            return [r[0] for r in conn.execute("SELECT body || ' ' || params_json FROM notifications WHERE source = 'backup.offbox_failed' ORDER BY rowid").fetchall()]

    w.drive.quota_limit = 1
    assert offbox_runtime.after_backup(w.db, w.settings, name)[0]["error"] == "quota_exceeded"
    assert offbox_runtime.REASON_HE["quota_exceeded"] in json.dumps(alert(), ensure_ascii=False)
    w.drive.quota_limit = None
    w.drive.rate_limit_always = True
    assert offbox_runtime.after_backup(w.db, w.settings, name)[0]["error"] == "rate_limited"
    w.drive.rate_limit_always = False
    w.drive.revoked = True
    assert offbox_runtime.after_backup(w.db, w.settings, name)[0]["error"] == "gdrive_reconnect_required"
    assert offbox_runtime.REASON_HE["gdrive_reconnect_required"] in json.dumps(alert(), ensure_ascii=False)
    last = w.c.get(URL).json()["targets"][0]["last"]["push"]
    assert last["ok"] is False and last["error"] == "gdrive_reconnect_required"
    copies = w.c.get(f"{URL}/targets/{t['id']}/copies")
    assert copies.status_code == 422 and copies.json()["code"] == "gdrive_reconnect_required" and "Google" in copies.json()["user_message"]
    for code in ("quota_exceeded", "rate_limited", "gdrive_reconnect_required", "gdrive_not_connected", "gdrive_client_invalid"):
        assert any(0x0590 <= ord(ch) <= 0x05FF for ch in offbox_runtime.REASON_HE[code]), code  # Hebrew words


def test_client_change_drops_the_token_and_disconnect_revokes(world):
    w = world
    t = _create(w)
    _connect(w, t["id"])
    w.c.patch(f"{URL}/targets/{t['id']}", json={"enabled": True})
    other = "222-otherclient.apps.googleusercontent.com"
    r = w.c.put(f"{URL}/targets/{t['id']}", json=_body(enabled=True, config={"client_id": other}))
    assert r.status_code == 422 and r.json()["code"] == "gdrive_not_connected"
    r = w.c.put(f"{URL}/targets/{t['id']}", json=_body(config={"client_id": other}))
    assert r.status_code == 200 and r.json()["secrets"]["refresh_token"] is False and r.json()["enabled"] is False
    w.c.put(f"{URL}/targets/{t['id']}", json=_body())
    _connect(w, t["id"])
    w.c.patch(f"{URL}/targets/{t['id']}", json={"enabled": True})
    d = w.c.post(f"{URL}/targets/{t['id']}/gdrive/disconnect")
    assert d.status_code == 200 and d.json()["had_token"] is True and d.json()["revoked"] is True
    assert d.json()["target"]["enabled"] is False and d.json()["target"]["secrets"]["refresh_token"] is False
    assert w.drive.revoke_calls == ["token"]
    test = w.c.post(f"{URL}/targets/{t['id']}/test").json()
    assert test["ok"] is False and test["error"] == "gdrive_not_connected"


def test_migration_0186_keeps_every_row_and_accepts_gdrive(world):
    w = world
    s3 = w.c.post(f"{URL}/targets", json={"name": "Cloud", "kind": "s3", "enabled": False,
                                          "config": {"endpoint": "https://s3.example.net", "bucket": "arx-bk"},
                                          "secrets": {"access_key": "AKX", "secret_key": "SKX"}}).json()
    with w.db.connection() as conn:
        conn.execute("INSERT INTO backup_offbox_runs(target_id, action, trigger, started_at, ok) VALUES (?, 'test', 'manual', '2026-10-31T00:00:00Z', 1)",
                     (s3["id"],))
    before = _db_text(w)
    sql = (MIGRATIONS_DIR / "0186_offbox_gdrive.sql").read_text(encoding="utf-8")
    conn = sqlite3.connect(w.db.path, isolation_level=None)
    try:
        conn.execute("PRAGMA foreign_keys=ON")
        conn.executescript(f"BEGIN;\n{sql}\nCOMMIT;")  # applied again over existing rows: the rebuild loses nothing
        assert conn.execute("PRAGMA foreign_key_check").fetchall() == []
        tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'").fetchall()}
        assert not {t for t in tables if t.endswith("_0186")}
    finally:
        conn.close()
    assert _db_text(w) == before
    _create(w)  # the widened CHECKs take the new kind and secret field


def test_only_system_administrators_and_never_in_a_project_backup(world):
    w = world
    t = _create(w)
    ids = seed_tree(w.c)
    bind(w.c, w.settings, "ron", "site_admin", "site", ids["site"])
    h = as_user("ron")
    for suffix in ("connect", "poll", "disconnect"):
        assert w.c.post(f"{URL}/targets/{t['id']}/gdrive/{suffix}", headers=h).status_code == 403, suffix
    assert w.c.post(f"{URL}/targets", json=_body(), headers=h).status_code == 403
    assert w.drive.calls == []
    assert not {"backup_offbox_targets", "backup_offbox_secrets", "backup_offbox_runs"} & set(backup_svc.PROJECT_TABLES + backup_svc.ACCESS_TABLES)
