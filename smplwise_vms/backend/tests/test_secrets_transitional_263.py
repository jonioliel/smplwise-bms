"""Release 2.6.3 - the delta review's must-fix items for the secrets store (private/planning/RELEASE_263_DELTA_REVIEW_2026-10-16.md).

S-2: load_settings() (it also runs at runtime: rules.py, ha_history.py) never writes the legacy `push_relay_key` option back into
SW_PUSH_RELAY_KEY - a key rotated or cleared in the store never comes back.
S-1 (lead decision, transitional for one version): the former secret options are declared again as deprecated `password?`; after the
one-time import Arx empties them through the one self-options writer, which may only EMPTY them. Negative first: a value still needed
is never emptied, a refused write changes nothing and reports the names, no value ever reaches a log line or the request body.
Every value here is invented."""
from __future__ import annotations

import json
import logging

import httpx
import pytest

from smplwise.config import load_settings
from smplwise.db import Database
from smplwise.main import create_app
from smplwise.services import connection_store, secrets_store, self_update

OLD = {"go2rtc_api_password": "old-g2-value-0001", "push_relay_key": "old-pr-value-0005"}
BASE_OPTIONS = {"bootstrap_admin_username": "joni", "nvr_host": "", "nvr_http_port": 80, "nvr_rtsp_port": 554, "nvr_username": "",
                "go2rtc_url": "", "go2rtc_api_username": "", "wiskey_username": "", "remote_access": False, "remote_path": "/arx",
                "push_relay_url": "", "cast_relay": False, "tickets_public": False, "frigate_enabled": False, "db_write_gate": True,
                "log_level": "info", "nvr_password": "", "go2rtc_api_password": "", "wiskey_password": "", "wiskey_background_token": "",
                "openai_api_key": "", "push_relay_key": ""}


@pytest.fixture(autouse=True)
def _env_and_seams(monkeypatch):
    monkeypatch.setenv("SW_PUSH_RELAY_KEY", "placeholder")
    monkeypatch.delenv("SW_PUSH_RELAY_KEY")
    monkeypatch.setenv("SW_PUSH_RELAY_URL", "placeholder")
    monkeypatch.delenv("SW_PUSH_RELAY_URL")
    for name in ("GO2RTC_API_PASSWORD", "WISKEY_PASSWORD", "WISKEY_BACKGROUND_TOKEN", "OPENAI_API_KEY"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setattr(self_update, "BASE_URL", "http://supervisor.test")
    monkeypatch.setattr(self_update, "TOKEN", "fake-supervisor-token")
    secrets_store.LINGERING_OPTIONS.clear()
    yield
    secrets_store.LINGERING_OPTIONS.clear()


def _write(tmp_path, monkeypatch, **opts):
    path = tmp_path / "options.json"
    path.write_text(json.dumps({**BASE_OPTIONS, **opts}), encoding="utf-8")
    monkeypatch.setenv("SW_DATA_DIR", str(tmp_path / "data"))
    monkeypatch.setenv("SW_DEV_USER", "joni")
    return path


def _supervisor(monkeypatch, status: int = 200) -> list[dict]:
    calls: list[dict] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append({"method": request.method, "path": request.url.path, "body": json.loads(request.content or b"null")})
        return httpx.Response(status, json={"result": "ok", "data": {}})

    monkeypatch.setattr(self_update, "TRANSPORT", httpx.MockTransport(handler))
    return calls


# ---------------------------------------------------------------- S-2

def test_s2_load_settings_never_puts_a_stale_push_key_back(tmp_path, monkeypatch):
    import os

    path = _write(tmp_path, monkeypatch, push_relay_key=OLD["push_relay_key"])
    s = load_settings(path)
    assert "SW_PUSH_RELAY_KEY" not in os.environ, "load_settings itself never writes the legacy key"
    db = Database(s.db_path)
    db.migrate()
    with db.connection() as conn:
        secrets_store.set_secret(conn, s.data_dir, "push_relay_key", "rotated-pr-value-0006", "u1")
    create_app(s)
    assert os.environ["SW_PUSH_RELAY_KEY"] == "rotated-pr-value-0006"
    load_settings(path)  # what rules.py / ha_history.py do at runtime
    assert os.environ["SW_PUSH_RELAY_KEY"] == "rotated-pr-value-0006", "the rotated key stays"
    with db.connection() as conn:
        secrets_store.clear_secret(conn, "push_relay_key", "u1")
    create_app(s)
    assert "SW_PUSH_RELAY_KEY" not in os.environ
    load_settings(path)
    assert "SW_PUSH_RELAY_KEY" not in os.environ, "a cleared key never comes back from the lingering option"


def test_s2_without_a_store_row_the_legacy_option_still_reaches_the_relay_at_start_up(tmp_path, monkeypatch):
    import os

    def boom(*_a, **_k):
        raise connection_store.SecretError("no key")

    monkeypatch.setattr(secrets_store, "seal_app_secret", boom)  # the import fails: no row, the option keeps working
    s = load_settings(_write(tmp_path, monkeypatch, push_relay_key=OLD["push_relay_key"]))
    create_app(s)
    assert os.environ["SW_PUSH_RELAY_KEY"] == OLD["push_relay_key"]


# ---------------------------------------------------------------- S-1: import, then empty the deprecated options

def test_s1_a_value_still_needed_is_never_emptied(tmp_path, monkeypatch, caplog):
    caplog.set_level(logging.DEBUG)
    calls = _supervisor(monkeypatch)

    def boom(*_a, **_k):
        raise connection_store.SecretError("no key")

    monkeypatch.setattr(secrets_store, "seal_app_secret", boom)
    path = _write(tmp_path, monkeypatch, **OLD)
    s = load_settings(path)
    app = create_app(s)
    assert secrets_store.clear_lingering_options(app.state.db, s, options_path=path) == []
    assert calls == [], "nothing is written while a value is still needed"
    assert sorted(secrets_store.LINGERING_OPTIONS) == sorted(OLD)
    assert all(v not in caplog.text for v in OLD.values())


def test_s1_a_lingering_nvr_password_without_a_stored_password_is_kept(tmp_path, monkeypatch):
    calls = _supervisor(monkeypatch)
    path = _write(tmp_path, monkeypatch, nvr_password="old-nvr-value-0007")
    s = load_settings(path)
    app = create_app(s)
    assert secrets_store.clear_lingering_options(app.state.db, s, options_path=path) == []
    assert calls == [] and secrets_store.LINGERING_OPTIONS == ["nvr_password"]


def test_s1_the_import_then_the_options_are_emptied_through_the_writer(tmp_path, monkeypatch, caplog):
    caplog.set_level(logging.DEBUG)
    calls = _supervisor(monkeypatch)
    path = _write(tmp_path, monkeypatch, **OLD)
    s = load_settings(path)
    app = create_app(s)
    with app.state.db.connection(mode="read") as conn:
        rows = {r["name"]: r for r in conn.execute("SELECT * FROM app_secrets")}
    assert set(rows) == set(OLD) and all(r["source"] == "addon_import" for r in rows.values())
    assert secrets_store.clear_lingering_options(app.state.db, s, options_path=path) == list(OLD)
    assert len(calls) == 1 and calls[0]["method"] == "POST" and calls[0]["path"] == "/addons/self/options"
    sent = calls[0]["body"]["options"]
    assert {k: sent[k] for k in OLD} == {k: "" for k in OLD}
    assert {k: v for k, v in sent.items() if k not in OLD} == {k: v for k, v in BASE_OPTIONS.items() if k not in OLD}, "everything else as it was"
    assert secrets_store.LINGERING_OPTIONS == []
    assert all(v not in caplog.text and v not in json.dumps(calls) for v in OLD.values())


def test_s1_the_import_is_skipped_when_the_store_already_has_a_row_and_the_option_is_still_emptied(tmp_path, monkeypatch):
    calls = _supervisor(monkeypatch)
    path = _write(tmp_path, monkeypatch, go2rtc_api_password=OLD["go2rtc_api_password"])
    s = load_settings(path)
    db = Database(s.db_path)
    db.migrate()
    with db.connection() as conn:
        secrets_store.set_secret(conn, s.data_dir, "go2rtc_api_password", "store-g2-value-0008", "u1")
    app = create_app(s)
    assert app.state.settings.go2rtc_password == "store-g2-value-0008", "the store decides, the lingering option is ignored"
    with app.state.db.connection(mode="read") as conn:
        row = conn.execute("SELECT source, updated_by FROM app_secrets WHERE name = 'go2rtc_api_password'").fetchone()
        assert (row["source"], row["updated_by"]) == ("ui", "u1"), "not re-imported"
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'secret.import'").fetchone()[0] == 0
    assert secrets_store.clear_lingering_options(app.state.db, s, options_path=path) == ["go2rtc_api_password"]
    assert calls[0]["body"]["options"]["go2rtc_api_password"] == ""


def test_s1_a_refused_write_changes_nothing_and_reports_the_names(tmp_path, monkeypatch):
    calls = _supervisor(monkeypatch, status=500)
    path = _write(tmp_path, monkeypatch, **OLD)
    s = load_settings(path)
    app = create_app(s)
    assert secrets_store.clear_lingering_options(app.state.db, s, options_path=path) == []
    assert len(calls) == 1 and sorted(secrets_store.LINGERING_OPTIONS) == sorted(OLD)


def test_s1_an_options_document_the_writer_does_not_know_is_never_sent(tmp_path, monkeypatch):
    calls = _supervisor(monkeypatch)
    path = _write(tmp_path, monkeypatch, some_future_option="x", **OLD)
    s = load_settings(path)
    app = create_app(s)
    assert secrets_store.clear_lingering_options(app.state.db, s, options_path=path) == []
    assert calls == [] and sorted(secrets_store.LINGERING_OPTIONS) == sorted(OLD)


def test_s1_outside_the_add_on_nothing_is_read_or_written(settings, monkeypatch):
    calls = _supervisor(monkeypatch)
    app = create_app(settings)
    assert secrets_store.clear_lingering_options(app.state.db, settings) == [] and calls == []
