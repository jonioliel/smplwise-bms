"""TKSECRETS2: the in-app secrets store (services/secrets_store.py, routers/app_secrets.py, migration 0093) that replaces the add-on
options of type `password` (go2rtc_api_password, wiskey_password, wiskey_background_token, openai_api_key, push_relay_key).

Negative first: no value in any API answer, log line or audit row; the wrong permission is refused before anything is written; an
unreadable key fails closed; the one-time migration from a legacy option is idempotent and never refills a cleared secret; then the
consumers (go2rtc, WisKey, OpenAI skins, the push relay) still get the secret."""
from __future__ import annotations

import dataclasses
import json
import logging
import sqlite3

import pytest
from conftest import as_user
from fastapi.testclient import TestClient

from smplwise.config import LEGACY_SECRET_OPTIONS, load_settings
from smplwise.db import Database
from smplwise.errors import ApiError
from smplwise.main import create_app
from smplwise.services import connection_store, secrets_store

VALUES = {
    "go2rtc_api_password": "g2-S3cret-value-0001",
    "wiskey_password": "wk-S3cret-value-0002",
    "wiskey_background_token": "bg-S3cret-value-0003",
    "openai_api_key": "sk-S3cret-value-0004",
    "push_relay_key": "pr-S3cret-value-0005",
}
BASE = "/api/v1/system/secrets"


@pytest.fixture(autouse=True)
def _push_env_restored(monkeypatch):
    """The push relay key reaches services/mobile_push through the process environment: every test leaves it as it found it
    (setenv records the original state, so the deletion and whatever the code under test writes are undone at teardown)."""
    monkeypatch.setenv("SW_PUSH_RELAY_KEY", "placeholder")
    monkeypatch.delenv("SW_PUSH_RELAY_KEY")
    monkeypatch.setenv("SW_PUSH_RELAY_URL", "placeholder")
    monkeypatch.delenv("SW_PUSH_RELAY_URL")
    for env in ("GO2RTC_API_PASSWORD", "WISKEY_PASSWORD", "WISKEY_BACKGROUND_TOKEN", "OPENAI_API_KEY"):
        monkeypatch.delenv(env, raising=False)


def _audit(settings) -> list[sqlite3.Row]:
    with Database(settings.db_path).connection(mode="read") as conn:
        return conn.execute("SELECT * FROM audit_log ORDER BY id").fetchall()


def _rows(settings) -> dict[str, sqlite3.Row]:
    with Database(settings.db_path).connection(mode="read") as conn:
        return {r["name"]: r for r in conn.execute("SELECT * FROM app_secrets").fetchall()}


def _no_value_in(text: str) -> None:
    for v in VALUES.values():
        assert v not in text


# ---------------------------------------------------------------- negative first

def test_no_value_in_any_answer_log_or_audit_row(settings, caplog):
    caplog.set_level(logging.DEBUG)
    client = TestClient(create_app(settings))
    seen: list[str] = []
    for name, value in VALUES.items():
        r = client.put(f"{BASE}/{name}", json={"value": value})
        assert r.status_code == 200, r.text
        assert r.json()["secret"]["configured"] is True and r.json()["secret"]["state"] == "set"
        seen.append(r.text)
    listing = client.get(BASE)
    assert listing.status_code == 200
    seen.append(listing.text)
    assert {s["name"] for s in listing.json()["secrets"]} == set(VALUES) | {"ha_users_token", "announce_cloud_key", "announce_translate_key"}  # USR1-263: + the store-only home-system users token; ANNOUNCE-295: + the cloud speech key; ANNOUNCE-297: + the translation key
    assert all(set(s) == {"name", "label_he", "label_en", "restart_required", "testable", "configured", "state", "source", "updated_at",
                          "updated_by", "updated_by_name"} for s in listing.json()["secrets"])
    r = client.delete(f"{BASE}/openai_api_key")
    assert r.status_code == 200 and r.json()["secret"]["configured"] is False and r.json()["secret"]["state"] == "not_set"
    seen.append(r.text)
    for text in seen:
        _no_value_in(text)
    _no_value_in(caplog.text)
    rows = _audit(settings)
    actions = [r["action"] for r in rows if r["resource_type"] == "secret"]
    assert actions.count("secret.update") == 5 and actions.count("secret.clear") == 1
    for row in rows:
        _no_value_in(json.dumps(dict(row), ensure_ascii=False))
    # encrypted at rest: neither the table nor the database files hold a value in clear
    for name, row in _rows(settings).items():
        assert row["value_enc"] is None or (row["value_enc"].startswith("v1:") and VALUES[name] not in row["value_enc"])
    for path in settings.data_dir.glob("smplwise.db*"):
        raw = path.read_bytes()
        for v in VALUES.values():
            assert v.encode() not in raw, path.name
    # the Settings repr never carries them either
    _no_value_in(repr(client.app.state.settings))


def test_the_wrong_permission_is_refused_and_nothing_is_written(settings):
    client = TestClient(create_app(settings))
    other = as_user("someone")  # a signed-in user without a role
    assert client.get(BASE, headers=other).status_code == 403
    assert client.put(f"{BASE}/openai_api_key", json={"value": VALUES["openai_api_key"]}, headers=other).status_code == 403
    assert client.delete(f"{BASE}/openai_api_key", headers=other).status_code == 403
    assert client.post(f"{BASE}/go2rtc_api_password/test", json={"value": "x"}, headers=other).status_code == 403
    # the refusal comes before the body: a malformed body still gets the 403, not a 422
    assert client.put(f"{BASE}/openai_api_key", content=b"{not json", headers={**other, "content-type": "application/json"}).status_code == 403
    assert _rows(settings) == {}
    denied = [r for r in _audit(settings) if r["decision"] == "denied"]
    assert denied and all(r["action"] == "system.configure" for r in denied)
    for row in _audit(settings):
        _no_value_in(json.dumps(dict(row), ensure_ascii=False))
    from smplwise.remote_channel import BLOCKED_ON_REMOTE

    assert "/api/v1/system/secrets" in BLOCKED_ON_REMOTE  # never reachable on the remote channel


def test_bad_requests_are_refused_without_echoing_the_value(settings):
    client = TestClient(create_app(settings))
    assert client.put(f"{BASE}/nvr_password", json={"value": "x"}).json()["code"] == "secret_unknown"
    r = client.put(f"{BASE}/openai_api_key", json={"value": VALUES["openai_api_key"], "extra": 1})
    assert r.status_code == 422
    _no_value_in(r.text)
    r = client.put(f"{BASE}/openai_api_key", json={"value": "sk-bad\nvalue"})
    assert r.status_code == 422 and "sk-bad" not in r.text
    assert client.put(f"{BASE}/openai_api_key", json={"value": "   "}).status_code == 422
    assert client.put(f"{BASE}/openai_api_key", json={"value": "x" * (secrets_store.VALUE_MAX + 1)}).status_code == 422
    assert client.post(f"{BASE}/openai_api_key/test", json={}).json()["code"] == "secret_not_testable"
    assert client.post(f"{BASE}/go2rtc_api_password/test", json={}).json()["code"] == "secret_not_set"
    assert _rows(settings) == {}


def test_an_unreadable_key_fails_closed(settings, caplog):
    client = TestClient(create_app(settings))
    assert client.put(f"{BASE}/go2rtc_api_password", json={"value": VALUES["go2rtc_api_password"]}).status_code == 200
    connection_store.key_path(settings).write_bytes(b"\x01" * 32)  # another key: the blob no longer decrypts
    item = next(s for s in client.get(BASE).json()["secrets"] if s["name"] == "go2rtc_api_password")
    assert item["state"] == "unreadable" and item["configured"] is False
    r = client.post(f"{BASE}/go2rtc_api_password/test", json={})
    assert r.status_code == 422 and r.json()["code"] == "secret_unreadable"
    # a restart with a lingering legacy option: the store row decides - None, never the stale option value
    caplog.set_level(logging.DEBUG)
    legacy = dataclasses.replace(settings, go2rtc_password="stale-option-value", legacy_secret_options={"go2rtc_api_password": "stale-option-value"})
    app = create_app(legacy)
    assert app.state.settings.go2rtc_password is None
    assert "go2rtc_api_password cannot be decrypted" in caplog.text
    assert "stale-option-value" not in caplog.text
    connection_store.key_path(settings).unlink()  # no key at all: the same
    assert create_app(settings).state.settings.go2rtc_password is None


def test_a_removed_option_can_never_be_written_back_through_the_supervisor():
    from smplwise.services import self_update

    for key in ("nvr_password",) + LEGACY_SECRET_OPTIONS:
        # 2.6.3 transitional: declared (deprecated) so an options write may carry the key - but ONLY empty, never a value
        assert self_update.OPTION_TYPES[key] == "cleared"
        for value in ("x", "a-real-looking-secret", 0, False, [], {}):
            with pytest.raises(self_update.ProbeRefused):
                self_update.check_allowed("POST", self_update.P_OPTIONS, {"options": {key: value}})
        assert self_update.check_allowed("POST", self_update.P_OPTIONS, {"options": {key: ""}}) == self_update.P_OPTIONS
        assert self_update.check_allowed("POST", self_update.P_OPTIONS, {"options": {key: None}}) == self_update.P_OPTIONS


def test_the_store_is_not_a_backup_table():
    from smplwise.services import backup

    assert "app_secrets" not in backup.PROJECT_TABLES + backup.ACCESS_TABLES


# ---------------------------------------------------------------- config.py and the one-time migration

def _options_settings(tmp_path, monkeypatch, opts: dict):
    path = tmp_path / "options.json"
    path.write_text(json.dumps({"bootstrap_admin_username": "joni", **opts}), encoding="utf-8")
    monkeypatch.setenv("SW_DATA_DIR", str(tmp_path / "data"))
    monkeypatch.setenv("SW_DEV_USER", "joni")
    return load_settings(path)


def test_load_settings_never_raises_without_the_keys_and_keeps_only_option_file_values(tmp_path, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-from-env-only")
    s = _options_settings(tmp_path, monkeypatch, {})
    assert s.legacy_secret_options == {} and s.openai_api_key == "sk-from-env-only"  # the developer env is a fallback, never "legacy option"
    s = _options_settings(tmp_path, monkeypatch, {"openai_api_key": VALUES["openai_api_key"], "wiskey_password": ""})
    assert s.legacy_secret_options == {"openai_api_key": VALUES["openai_api_key"]}
    assert VALUES["openai_api_key"] not in repr(s)


def test_the_migration_from_the_options_is_one_time_and_idempotent(tmp_path, monkeypatch, caplog):
    caplog.set_level(logging.DEBUG)
    monkeypatch.setenv("GO2RTC_API_PASSWORD", "env-never-imported")
    s = _options_settings(tmp_path, monkeypatch, dict(VALUES))
    app = create_app(s)
    rows = _rows(s)
    assert set(rows) == set(VALUES) and all(r["source"] == "addon_import" and r["updated_by"] is None for r in rows.values())
    for name, row in rows.items():
        assert connection_store.open_app_secret(s.data_dir, name, row["value_enc"]) == VALUES[name]
    for name in VALUES:
        assert f"the add-on option {name} was moved into the secrets store" in caplog.text
    _no_value_in(caplog.text)
    imports = [r for r in _audit(s) if r["action"] == "secret.import"]
    assert sorted(r["resource_id"] for r in imports) == sorted(VALUES)
    for row in imports:
        _no_value_in(json.dumps(dict(row), ensure_ascii=False))
    assert TestClient(app).get(BASE).json()["secrets"][0]["source"] == "addon_import"
    # a second start: nothing moves again
    stamp = {n: r["updated_at"] for n, r in rows.items()}
    create_app(s)
    assert {n: r["updated_at"] for n, r in _rows(s).items()} == stamp
    assert len([r for r in _audit(s) if r["action"] == "secret.import"]) == 5
    # the administrator clears one while the stale option lingers: a third start never refills it, and the consumer gets none
    TestClient(app).delete(f"{BASE}/go2rtc_api_password")
    app3 = create_app(s)
    assert _rows(s)["go2rtc_api_password"]["value_enc"] is None
    assert app3.state.settings.go2rtc_password is None  # not the option, not the env


def test_an_environment_value_is_never_imported(tmp_path, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-env-dev-run")
    s = _options_settings(tmp_path, monkeypatch, {})
    app = create_app(s)
    assert _rows(s) == {}
    assert app.state.settings.openai_api_key == "sk-env-dev-run"  # the developer fallback still works with no store row
    item = next(x for x in TestClient(app).get(BASE).json()["secrets"] if x["name"] == "openai_api_key")
    assert item["state"] == "legacy" and item["source"] == "environment" and item["configured"] is True


def test_a_key_failure_skips_the_import_and_the_option_keeps_working(tmp_path, monkeypatch, caplog):
    caplog.set_level(logging.DEBUG)
    s = _options_settings(tmp_path, monkeypatch, {"openai_api_key": VALUES["openai_api_key"]})

    def boom(*_a, **_k):
        raise connection_store.SecretError("the connection key cannot be created")

    monkeypatch.setattr(secrets_store, "seal_app_secret", boom)
    app = create_app(s)
    assert _rows(s) == {}
    assert app.state.settings.openai_api_key == VALUES["openai_api_key"]
    assert "openai_api_key could not be moved" in caplog.text
    _no_value_in(caplog.text)


# ---------------------------------------------------------------- the consumers still get the secret

def test_consumers_get_the_secret_from_the_store_at_start_up(settings, monkeypatch):
    import os

    from smplwise.services import mobile_push, wiskey_camera

    db = Database(settings.db_path)
    db.migrate()
    with db.connection() as conn:
        for name, value in VALUES.items():
            secrets_store.set_secret(conn, settings.data_dir, name, value, "u1")
    s = dataclasses.replace(settings, go2rtc_user="g2user", wiskey_user="door", go2rtc_url="http://go2rtc.test:1984")
    app = create_app(s)
    eff = app.state.settings
    assert eff.go2rtc_password == VALUES["go2rtc_api_password"]
    assert eff.wiskey_password == VALUES["wiskey_password"] and wiskey_camera.default_configured(eff)
    assert eff.wiskey_background_token == VALUES["wiskey_background_token"]
    assert eff.openai_api_key == VALUES["openai_api_key"]
    assert os.environ["SW_PUSH_RELAY_KEY"] == VALUES["push_relay_key"] and mobile_push.relay_key() == VALUES["push_relay_key"]
    from smplwise.services import go2rtc as g2

    assert g2.Go2rtc(eff).auth == ("g2user", VALUES["go2rtc_api_password"])
    assert TestClient(app).get("/api/v1/skins/status").json()["key_configured"] is True


def test_a_save_reaches_request_handlers_at_once(settings):
    from smplwise.services import mobile_push

    client = TestClient(create_app(settings))
    assert client.get("/api/v1/skins/status").json()["key_configured"] is False
    r = client.put(f"{BASE}/openai_api_key", json={"value": "  " + VALUES["openai_api_key"] + "  "})  # pasted with spaces
    assert r.json()["restart_required"] is False
    assert client.app.state.settings.openai_api_key == VALUES["openai_api_key"]
    assert client.get("/api/v1/skins/status").json()["key_configured"] is True
    client.put(f"{BASE}/push_relay_key", json={"value": VALUES["push_relay_key"]})
    assert mobile_push.relay_key() == VALUES["push_relay_key"]
    client.delete(f"{BASE}/push_relay_key")
    assert mobile_push.relay_key() is None
    client.delete(f"{BASE}/openai_api_key")
    assert client.get("/api/v1/skins/status").json()["key_configured"] is False
    r = client.put(f"{BASE}/go2rtc_api_password", json={"value": VALUES["go2rtc_api_password"]})
    assert r.json()["restart_required"] is True and client.app.state.settings.go2rtc_password == VALUES["go2rtc_api_password"]
    r = client.get(BASE).json()["secrets"]
    who = next(x for x in r if x["name"] == "go2rtc_api_password")
    assert who["source"] == "ui" and who["updated_by"] and who["updated_at"]


def test_the_further_recorders_inherit_a_saved_secret(settings):
    app = create_app(settings)
    child = dataclasses.replace(app.state.settings, nvr_recorder_id="nvr-2", recorder_settings={})
    app.state.settings = dataclasses.replace(app.state.settings, recorder_settings={"nvr-2": child})
    TestClient(app).put(f"{BASE}/go2rtc_api_password", json={"value": VALUES["go2rtc_api_password"]})
    assert app.state.settings.recorder_settings["nvr-2"].go2rtc_password == VALUES["go2rtc_api_password"]


def test_the_go2rtc_test_answers_an_outcome_only(settings, monkeypatch, caplog):
    from smplwise.services import go2rtc as g2

    caplog.set_level(logging.DEBUG)
    seen: list[tuple] = []

    def fake_info(self):
        seen.append(self.auth)
        if self.auth != ("g2user", VALUES["go2rtc_api_password"]):
            raise ApiError(503, "media_error", "go2rtc החזיר שגיאה.", details={"status": 401})
        return {"version": "1.9.14"}

    monkeypatch.setattr(g2.Go2rtc, "info", fake_info)
    s = dataclasses.replace(settings, go2rtc_url="http://go2rtc.test:1984", go2rtc_user="g2user")
    client = TestClient(create_app(s))
    r = client.post(f"{BASE}/go2rtc_api_password/test", json={"value": "wrong-candidate"})
    assert r.status_code == 200 and r.json() == {"ok": False, "code": "unauthorized"}
    r = client.post(f"{BASE}/go2rtc_api_password/test", json={"value": VALUES["go2rtc_api_password"]})
    assert r.json() == {"ok": True, "code": "ok"}
    client.put(f"{BASE}/go2rtc_api_password", json={"value": VALUES["go2rtc_api_password"]})
    assert client.post(f"{BASE}/go2rtc_api_password/test", json={}).json() == {"ok": True, "code": "ok"}  # the stored value
    assert seen[-1] == ("g2user", VALUES["go2rtc_api_password"])
    tests = [r for r in _audit(s) if r["action"] == "secret.test"]
    assert [json.loads(r["details_json"])["candidate"] for r in tests] == [True, True, False]
    for row in tests:
        _no_value_in(json.dumps(dict(row), ensure_ascii=False))
        assert "wrong-candidate" not in json.dumps(dict(row), ensure_ascii=False)
    _no_value_in(caplog.text)
    # no user name configured: said so, nothing sent
    client2 = TestClient(create_app(dataclasses.replace(settings, go2rtc_url="http://go2rtc.test:1984")))
    n = len(seen)
    assert client2.post(f"{BASE}/go2rtc_api_password/test", json={"value": "x"}).json()["code"] == "username_missing"
    assert len(seen) == n


def test_the_wiskey_test_uses_the_shared_account_on_a_station_without_its_own(settings, monkeypatch):
    from smplwise.services import go2rtc as g2
    from smplwise.services import intercom_sync

    overview = {"stations": [{"id": "gate", "name": "שער", "camera_entity": "camera.gate", "online": True},
                             {"id": "lobby", "name": "לובי", "camera_entity": "camera.lobby", "online": True}]}
    monkeypatch.setattr(intercom_sync.SYNC, "served", lambda _s: ("ready", overview))
    monkeypatch.setattr(intercom_sync.SYNC, "station_host", lambda _s, sid: "door-" + sid + ".test")
    grabs: list[tuple[str, str]] = []

    def fake_frame(self, name, src):
        grabs.append((name, src))
        if "wrong" in src:
            raise ApiError(503, "snapshot_unavailable", "x")
        return b"\xff\xd8\xff"

    deleted: list[str] = []
    monkeypatch.setattr(g2.Go2rtc, "frame_jpeg", fake_frame)
    monkeypatch.setattr(g2.Go2rtc, "delete_stream", lambda self, name: deleted.append(name))
    s = dataclasses.replace(settings, go2rtc_url="http://go2rtc.test:1984", wiskey_user="door")
    app = create_app(s)
    with Database(s.db_path).connection() as conn:  # the gate has its own account: the shared one is tested on the lobby
        conn.execute("INSERT INTO wiskey_station_credentials(station_id, username, password, updated_at, updated_by) VALUES ('gate', 'g', 'p', 'now', 'u')")
    client = TestClient(app)
    r = client.post(f"{BASE}/wiskey_password/test", json={"value": "wrong-pass"})
    assert r.json() == {"ok": False, "code": "station_failed"}
    r = client.post(f"{BASE}/wiskey_password/test", json={"value": VALUES["wiskey_password"]})
    assert r.json() == {"ok": True, "code": "ok"} and "wk-" not in r.text
    # delta review S-4: a throwaway stream in our namespace, never the live station stream, deleted after every test
    assert all(name.startswith("smplwise_wiskey_probe_") and name != g2.wiskey_stream_name("lobby") for name, _ in grabs)
    assert len({name for name, _ in grabs}) == len(grabs) == len(deleted) and deleted == [name for name, _ in grabs]
    assert grabs[-1][1].startswith("rtsp://door:")
