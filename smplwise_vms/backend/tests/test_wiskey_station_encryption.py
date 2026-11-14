"""TKWISECRYPT (delta review S-5): the per-station WisKey camera password (wiskey_station_credentials, migration 0024) is sealed with the
per-install connection key (services/connection_store.seal_station_secret, migration 0094 password_enc), converted once at start-up.

Negative first: the plaintext is never in the database file (nor its WAL) after the conversion or after a write, never in a log line,
an audit row, an API answer or a backup; an unreadable key keeps the legacy row working and warns with the station id only; a write
without a key writes nothing; a sealed value of one station does not open for another."""
from __future__ import annotations

import json
import logging
import zipfile

import pytest
from fastapi.testclient import TestClient

from smplwise.db import Database
from smplwise.errors import ApiError
from smplwise.main import create_app
from smplwise.services import backup, connection_store, wiskey_camera
from smplwise.services.connection_store import SecretError

PW = "Z9-plain-station-pass-77"
PW2 = "Q4-second-station-pass-88"
CREDS = "/api/v1/intercom/stations/{}/credentials"


def _file_bytes(settings) -> bytes:
    out = b""
    for suffix in ("", "-wal", "-shm"):
        p = settings.db_path.with_name(settings.db_path.name + suffix)
        if p.exists():
            out += p.read_bytes()
    return out


def _seed_plain(settings, rows=(("gate", PW), ("lobby", PW2))) -> None:
    db = Database(settings.db_path)
    db.migrate()
    with db.connection() as conn:
        for sid, pw in rows:
            conn.execute("INSERT INTO wiskey_station_credentials(station_id, username, password, updated_at, updated_by) VALUES (?, 'door', ?, 'now', 'u')", (sid, pw))


def _rows(settings):
    with Database(settings.db_path).connection(mode="read") as conn:
        return {r["station_id"]: dict(r) for r in conn.execute("SELECT * FROM wiskey_station_credentials").fetchall()}


def _audit(settings):
    with Database(settings.db_path).connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM audit_log ORDER BY id").fetchall()]


def test_a_write_through_the_api_never_leaves_the_plaintext_anywhere(settings, caplog):
    caplog.set_level(logging.DEBUG)
    client = TestClient(create_app(settings))
    r = client.put(CREDS.format("gate"), json={"username": "door", "password": PW})
    assert r.status_code == 200 and PW not in r.text
    for resp in (client.get(CREDS.format("gate")), client.get("/api/v1/intercom/stations/credentials")):
        assert resp.status_code == 200 and PW not in resp.text and "password" not in resp.text
    row = _rows(settings)["gate"]
    assert row["password"] == "" and row["password_enc"].startswith("v1:") and PW not in row["password_enc"]
    assert PW.encode() not in _file_bytes(settings)
    assert PW not in caplog.text
    assert PW not in json.dumps(_audit(settings), ensure_ascii=False)
    with client.app.state.db.connection() as conn:  # the reader gets the value back
        assert wiskey_camera.credentials(conn, client.app.state.settings, "gate") == ("door", PW)
    # a second write replaces it, still sealed
    assert client.put(CREDS.format("gate"), json={"username": "door", "password": PW2}).status_code == 200
    assert PW2.encode() not in _file_bytes(settings) and PW.encode() not in _file_bytes(settings)


def test_the_start_up_conversion_seals_every_plaintext_row_and_leaves_none_in_the_file(settings, caplog):
    _seed_plain(settings)
    assert PW.encode() in _file_bytes(settings), "precondition: the legacy row is plaintext on disk"
    caplog.set_level(logging.DEBUG)
    app = create_app(settings)
    rows = _rows(settings)
    for sid in ("gate", "lobby"):
        assert rows[sid]["password"] == "" and rows[sid]["password_enc"].startswith("v1:")
    blob = _file_bytes(settings)
    assert PW.encode() not in blob and PW2.encode() not in blob
    assert PW not in caplog.text and PW2 not in caplog.text
    audit = [r for r in _audit(settings) if r["action"] == "secret.encrypt"]
    assert sorted(r["resource_id"] for r in audit) == ["gate", "lobby"]
    for r in audit:
        assert PW not in json.dumps(r) and PW2 not in json.dumps(r) and json.loads(r["details_json"])["station_id"] == r["resource_id"]
    with app.state.db.connection() as conn:
        assert wiskey_camera.credentials(conn, app.state.settings, "gate") == ("door", PW)
        assert wiskey_camera.credentials(conn, app.state.settings, "lobby") == ("door", PW2)


def test_the_conversion_is_idempotent(settings):
    _seed_plain(settings)
    create_app(settings)
    first = _rows(settings)
    n = len([r for r in _audit(settings) if r["action"] == "secret.encrypt"])
    create_app(settings)
    assert _rows(settings) == first, "a converted row is not touched again"
    assert len([r for r in _audit(settings) if r["action"] == "secret.encrypt"]) == n == 2


def test_an_unreadable_key_keeps_the_plaintext_working_and_warns_with_names_only(settings, caplog):
    _seed_plain(settings)
    kp = connection_store.key_path(settings)
    kp.parent.mkdir(parents=True, exist_ok=True)
    kp.write_bytes(b"short")  # a damaged key file: sealing is impossible
    caplog.set_level(logging.DEBUG)
    app = create_app(settings)
    rows = _rows(settings)
    assert rows["gate"]["password"] == PW and rows["gate"]["password_enc"] is None, "fail closed: nothing was touched"
    assert "gate" in caplog.text and "could not be encrypted" in caplog.text
    assert PW not in caplog.text and PW2 not in caplog.text
    assert not [r for r in _audit(settings) if r["action"] == "secret.encrypt"]
    with app.state.db.connection() as conn:  # the legacy path still works
        assert wiskey_camera.credentials(conn, app.state.settings, "gate") == ("door", PW)
    # and a write without a usable key stores nothing (never a plaintext fallback)
    client = TestClient(app)
    r = client.put(CREDS.format("new-one"), json={"username": "door", "password": "fresh-pass-123"})
    assert r.status_code == 503 and "fresh-pass-123" not in r.text
    assert "new-one" not in _rows(settings)
    # once the key is usable again the next start converts
    kp.unlink()
    create_app(settings)
    assert _rows(settings)["gate"]["password"] == "" and PW.encode() not in _file_bytes(settings)


def test_a_changed_key_fails_closed_without_falling_back_to_the_shared_account(settings):
    client = TestClient(create_app(settings))
    assert client.put(CREDS.format("gate"), json={"username": "door", "password": PW}).status_code == 200
    connection_store.key_path(settings).write_bytes(b"\x01" * 32)
    with client.app.state.db.connection() as conn:
        with pytest.raises(ApiError) as exc:
            wiskey_camera.credentials(conn, client.app.state.settings, "gate")
    assert exc.value.status == 503 and exc.value.code == "credentials_unreadable" and PW not in exc.value.user_message


def test_the_sealed_value_is_bound_to_its_station(settings):
    sealed = connection_store.seal_station_secret(settings.data_dir, "gate", PW)
    assert connection_store.open_station_secret(settings.data_dir, "gate", sealed) == PW
    with pytest.raises(SecretError):
        connection_store.open_station_secret(settings.data_dir, "lobby", sealed)
    with pytest.raises(SecretError):  # nor as an app secret
        connection_store.open_app_secret(settings.data_dir, "wiskey_password", sealed)


def test_a_backup_does_not_contain_the_plaintext(settings):
    _seed_plain(settings)
    app = create_app(settings)
    with app.state.db.connection() as conn:
        data = backup.snapshot(conn, include_access=True, include_audit=True, include_events=True)
        assert "wiskey_station_credentials" not in data
        made = backup.create(app.state.settings, conn, include_access=True, include_audit=True, include_events=True)
    assert PW not in json.dumps(data, default=str)
    path = backup.backups_dir(app.state.settings) / made["name"] if "name" in made else None
    paths = [path] if path and path.exists() else list(backup.backups_dir(app.state.settings).glob("*.zip"))
    assert paths
    for p in paths:
        with zipfile.ZipFile(p) as z:
            for n in z.namelist():
                content = z.read(n)
                assert PW.encode() not in content and PW2.encode() not in content, n
