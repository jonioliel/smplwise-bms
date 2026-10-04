"""CR-016 section 18 (music hardening): the direct Music Assistant connection stores its token encrypted at rest (the NVR connection's AES-256-GCM
store and key file), checks the server address (SSRF defences), is local-only, has one hard time budget per call and refuses with clear Hebrew texts.
Everything is a fake: the FakeMA of test_media_ma_direct, an httpx MockTransport, a stubbed resolver and (for the hard budget) a throw-away socket on
127.0.0.1 inside the test process. Nothing here reaches a real music server, Home Assistant or NVR."""
from __future__ import annotations

import json
import logging
import socket
import threading
import time
from typing import Any
from urllib.parse import urlsplit

import httpx
import pytest
from conftest import as_user, bind
from test_media_ma_direct import API, TOKEN, URL, FakeMA, _post, _rows, audit_rows, body, connect, d, lan_resolver  # noqa: F401 - fixtures

from smplwise import remote_channel
from smplwise.db import get_setting, now_iso, set_setting
from smplwise.main import create_app
from smplwise.services import backup, connection_probe, connection_store, ma_direct, media_queue

SERVER_IP = "192.168.1.50"


def stored(app) -> dict[str, Any]:
    with app.state.db.connection(mode="read") as conn:
        return json.loads(get_setting(conn, ma_direct.CONFIG_KEY) or "{}")


def resolver(monkeypatch, answers: dict[str, list[str]]) -> list[str]:
    asked: list[str] = []

    def res(host: str) -> list[str]:
        asked.append(host)
        return list(answers.get(host, []))

    monkeypatch.setattr(connection_probe, "RESOLVE", res)
    return asked


# ------------------------------------------------------------------------------------------------ the token at rest


def test_the_token_is_encrypted_at_rest_and_nowhere_in_the_data_folder(d, caplog):
    app, c, fake, bridge, keys, settings, _ = d
    with caplog.at_level(logging.DEBUG):
        view = connect(c)
        c.post(f"{API}/admin/ma-connection/test")
    assert view["token_storage"] == "encrypted" and view["token_set"] is True and TOKEN not in json.dumps(view)
    cfg = stored(app)
    assert cfg["token_enc"].startswith("v1:") and TOKEN not in json.dumps(cfg)
    assert not ma_direct.secret_path(settings.data_dir).exists()
    needle = TOKEN.encode()
    for path in settings.data_dir.rglob("*"):
        if path.is_file():
            assert needle not in path.read_bytes(), f"the plain token is in {path.name}"
    assert TOKEN not in caplog.text and SERVER_IP not in caplog.text
    # the call really used the decrypted token (the fake asserts it) and the blob is bound to its row and field
    assert any(cmd == "players/all" for cmd, _ in fake.calls)
    with pytest.raises(connection_store.SecretError):
        connection_store.decrypt(settings, "default", "password", cfg["token_enc"])
    nvr_blob = connection_store.encrypt(settings, "default", "password", "nvr-password-canary")
    assert connection_store.open_service_secret(settings.data_dir, "music_assistant", "default", "token", cfg["token_enc"]) == TOKEN
    with pytest.raises(connection_store.SecretError):
        connection_store.open_service_secret(settings.data_dir, "music_assistant", "default", "token", nvr_blob)
    with pytest.raises(connection_store.SecretError):
        connection_store.seal_service_secret(settings.data_dir, "music_assistant", "default", "other", "x")


def test_the_nvr_blobs_still_decrypt_after_the_refactor(settings):
    blob = connection_store.encrypt(settings, "default", "password", "canary-pw")
    assert connection_store.decrypt(settings, "default", "password", blob) == "canary-pw"
    assert connection_store.open_service_secret.__module__ == connection_store.__name__


def test_the_encrypted_token_never_enters_a_backup(d):
    app, c, *_ = d
    connect(c)
    with app.state.db.connection(mode="read") as conn:
        snap = backup.snapshot(conn)
    blob = stored(app)["token_enc"]
    assert blob not in json.dumps(snap, default=str) and TOKEN not in json.dumps(snap, default=str)


def test_a_key_failure_on_save_writes_nothing(d, monkeypatch):
    app, c, fake, bridge, keys, settings, _ = d

    def broken(*_a, **_kw):
        raise OSError("disk full")

    monkeypatch.setattr(connection_store, "_load_or_create_key", broken)
    r = c.put(f"{API}/admin/ma-connection", json={"enabled": True, "url": URL, "token": TOKEN})
    assert (r.status_code, r.json()["code"]) == (503, "storage_unavailable") and TOKEN not in r.text
    assert stored(app) == {} and not ma_direct.secret_path(settings.data_dir).exists()


def test_a_token_that_cannot_be_decrypted_is_the_unreadable_state_and_start_up_survives(d):
    app, c, fake, bridge, keys, settings, _ = d
    connect(c)
    items = _rows(c, keys)
    (settings.data_dir / "keys" / "connections.key").write_bytes(b"\x01" * 32)  # a key from another machine
    ma_direct.reset()
    view = c.get(f"{API}/admin/ma-connection").json()
    assert (view["state"], view["token_set"], view["token_storage"]) == ("unreadable", False, "unreadable")
    n = len(fake.calls)
    r = _post(c, keys, op="play", item=items["שיר 6"])
    assert (r.status_code, r.json()["code"], r.json()["details"]["state"]) == (503, "ma_unavailable", "unreadable")
    assert "האסימון" in r.json()["user_message"] and "הגדרות" in r.json()["user_message"]
    assert len(fake.calls) == n, "nothing is sent without a readable token"
    assert c.post(f"{API}/admin/ma-connection/test").json()["state"] == "unreadable" and len(fake.calls) == n
    create_app(settings)  # a start with an unreadable token does not fail
    assert c.put(f"{API}/admin/ma-connection", json={"token": TOKEN}).json()["state"] == "ready", "entering the token again repairs it"
    assert c.get(f"{API}/devices/{keys['a']}/queue").status_code == 200


def test_clearing_the_token_removes_the_blob(d):
    app, c, *_ = d
    connect(c)
    view = c.put(f"{API}/admin/ma-connection", json={"clear_token": True}).json()
    assert (view["token_set"], view["state"], view["token_storage"]) == (False, "off", "none")
    assert stored(app)["token_enc"] is None


# ------------------------------------------------------------------------------------------------ the one-time move of the plain file


def _plain(settings, token: str = TOKEN) -> Any:
    p = ma_direct.secret_path(settings.data_dir)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(token, encoding="utf-8")
    return p


def test_a_plain_token_file_is_imported_once_at_start_up_and_removed(settings, monkeypatch, caplog):
    fake = FakeMA()
    monkeypatch.setattr(ma_direct, "TRANSPORT", [fake])
    plain = _plain(settings)
    app = create_app(settings)  # the start-up import
    assert not plain.exists(), "the plain copy is removed"
    cfg = stored(app)
    assert cfg["token_enc"].startswith("v1:") and cfg["token_set_at"]
    rows = audit_rows(app, "media.ma_connection")
    assert rows[-1]["details"] == {"op": "token_import", "token": "moved"} and TOKEN not in json.dumps(rows)
    from fastapi.testclient import TestClient

    c = TestClient(app)
    assert c.put(f"{API}/admin/ma-connection", json={"enabled": True, "url": URL}).json()["state"] == "ready"
    assert c.post(f"{API}/admin/ma-connection/test").json()["state"] == "ready", "the migrated token works (the fake asserts it)"
    assert ma_direct.migrate_legacy_token(app.state.db, settings) == "none", "once: nothing to move the second time"
    assert TOKEN not in caplog.text


def test_a_failed_move_keeps_the_file_and_the_connection_keeps_working(d, monkeypatch, caplog):
    app, c, fake, bridge, keys, settings, _ = d
    connect(c)
    c.put(f"{API}/admin/ma-connection", json={"clear_token": True})
    plain = _plain(settings)

    def broken(*_a, **_kw):
        raise connection_store.SecretError("key")

    monkeypatch.setattr(connection_store, "seal_service_secret", broken)
    with caplog.at_level(logging.DEBUG):
        assert ma_direct.migrate_legacy_token(app.state.db, settings) == "failed"
    assert plain.exists() and plain.read_text(encoding="utf-8") == TOKEN
    assert TOKEN not in caplog.text
    ma_direct.reset()
    c.put(f"{API}/admin/ma-connection", json={"enabled": True, "url": URL})
    view = c.get(f"{API}/admin/ma-connection").json()
    assert (view["token_set"], view["token_storage"], view["state"]) == (True, "file", "ready"), "the plain file still works until the move succeeds"


def test_a_database_failure_during_the_move_keeps_the_file(d, monkeypatch):
    app, c, fake, bridge, keys, settings, _ = d
    plain = _plain(settings)

    def boom(*_a, **_kw):
        raise RuntimeError("database is locked")

    monkeypatch.setattr(ma_direct, "_save_config", boom)
    assert ma_direct.migrate_legacy_token(app.state.db, settings) == "failed" and plain.exists()
    assert "token_enc" not in stored(app) or not stored(app).get("token_enc")


def test_a_plain_file_beside_an_older_blob_wins_after_a_downgrade(d):
    app, c, fake, bridge, keys, settings, _ = d
    connect(c)
    old = stored(app)["token_enc"]
    newer = TOKEN  # the older version wrote a file while it ran; the file is newer than the blob
    _plain(settings, newer)
    assert ma_direct.migrate_legacy_token(app.state.db, settings) == "moved"
    assert stored(app)["token_enc"] != old and not ma_direct.secret_path(settings.data_dir).exists()
    assert c.post(f"{API}/admin/ma-connection/test").json()["state"] == "ready"


def test_setting_a_new_token_removes_a_leftover_plain_file(d):
    app, c, fake, bridge, keys, settings, _ = d
    plain = _plain(settings)
    connect(c)
    assert not plain.exists()


# ------------------------------------------------------------------------------------------------ the address (SSRF)


@pytest.mark.parametrize("url", [
    "http://127.0.0.1:8095", "http://localhost:8095", "http://[::1]:8095", "http://0.0.0.0:8095", "http://169.254.169.254", "http://169.254.169.254:8095",
    "http://[fe80::1]:8095", "http://172.30.32.1:8095", "http://supervisor:8095", "http://homeassistant:8095", "http://metadata.google.internal",
    "http://0x7f.1:8095", "http://2130706433:8095", "http://[::ffff:127.0.0.1]:8095", "http://100.64.0.1:8095", "http://100.100.100.200",
    "http://8.8.8.8:8095", "http://[2001:4860:4860::8888]:8095", "http://arx-test-host:8095", "http://172.30.32.2:8095",  # a trusted proxy
    "http://public.test:8095", "http://loop.test:8095", "http://mixed.test:8095",
])
def test_an_address_outside_the_private_lan_is_refused_before_anything_is_stored_or_sent(d, monkeypatch, url):
    app, c, fake, *_ = d
    resolver(monkeypatch, {"public.test": ["8.8.8.8"], "loop.test": ["127.0.0.1"], "mixed.test": [SERVER_IP, "127.0.0.1"]})
    r = c.put(f"{API}/admin/ma-connection", json={"enabled": True, "url": url, "token": TOKEN})
    assert (r.status_code, r.json()["code"]) == (422, "host_refused"), url
    assert "כתובת פרטית" in r.json()["user_message"]
    assert stored(app) == {} and fake.calls == []
    rows = audit_rows(app, "media.ma_connection")
    assert rows and rows[-1]["decision"] == "denied" and rows[-1]["reason"] == "host_refused"
    assert urlsplit(url).hostname not in json.dumps(rows) and TOKEN not in json.dumps(rows)


@pytest.mark.parametrize("url", ["http://10.0.0.5:8123", "http://10.0.0.5:8094", "http://192.168.1.9:1984", "http://192.168.1.9:8554", "http://192.168.1.9:8099"])
def test_the_platforms_own_ports_are_never_a_music_server(d, url):
    app, c, fake, *_ = d
    r = c.put(f"{API}/admin/ma-connection", json={"url": url})
    assert (r.status_code, r.json()["code"]) == (422, "port_refused")
    assert audit_rows(app, "media.ma_connection")[-1]["reason"] == "port_refused" and fake.calls == []


def test_a_name_that_does_not_resolve_is_refused_and_asks_for_the_ip(d, monkeypatch):
    app, c, fake, *_ = d
    resolver(monkeypatch, {})
    r = c.put(f"{API}/admin/ma-connection", json={"url": "http://nowhere.test:8095"})
    assert (r.status_code, r.json()["code"]) == (422, "host_unresolved") and "IP" in r.json()["user_message"]
    assert fake.calls == []


@pytest.mark.parametrize("url", ["http://192.168.1.20:8095", "http://10.1.2.3:8095", "http://172.20.0.9:8095", "http://[fd00::5]:8095", "https://ma.example.test:8095",
                                 "http://ma.example.test"])
def test_private_lan_addresses_are_accepted(d, url):
    app, c, *_ = d
    r = c.put(f"{API}/admin/ma-connection", json={"url": url})
    assert r.status_code == 200 and r.json()["url"] == url.rstrip("/"), r.text


def test_credentials_in_the_address_and_other_schemes_stay_refused(d):
    app, c, fake, *_ = d
    for url in ("http://user:pw@192.168.1.20:8095", "ftp://192.168.1.20", "file:///etc/passwd", "gopher://192.168.1.20", "http://192.168.1.20/api"):
        assert c.put(f"{API}/admin/ma-connection", json={"url": url}).status_code == 422, url
    assert stored(app) == {}


def test_a_name_that_changes_to_a_bad_address_is_caught_on_the_next_check_not_followed(d, monkeypatch):
    """DNS rebinding: the answer is checked at every re-resolution (at most every PIN_S) and the call goes to the checked address only."""
    app, c, fake, bridge, keys, *_ = d
    answers = {"ma.example.test": [SERVER_IP]}
    asked = resolver(monkeypatch, answers)
    connect(c)
    assert c.get(f"{API}/devices/{keys['a']}/queue").status_code == 200
    first = len(asked)
    answers["ma.example.test"] = ["127.0.0.1"]
    assert c.get(f"{API}/devices/{keys['a']}/queue").status_code == 200 and len(asked) == first, "within the pin window the name is not asked again"
    ma_direct._PIN.clear()  # the window passed
    n = len(fake.calls)
    out = c.post(f"{API}/admin/ma-connection/test").json()
    assert out["state"] == "host_refused" and len(fake.calls) == n, "nothing was sent to the new address"
    assert c.get(f"{API}/admin/ma-connection").json()["state"] == "host_refused"
    answers["ma.example.test"] = [SERVER_IP]
    assert c.post(f"{API}/admin/ma-connection/test").json()["state"] == "ready", "a test checks afresh and repairs it"


def test_a_refused_runtime_address_says_so_in_hebrew(d, monkeypatch):
    app, c, fake, bridge, keys, *_ = d
    answers = {"ma.example.test": [SERVER_IP]}
    resolver(monkeypatch, answers)
    connect(c)
    items = _rows(c, keys)
    answers["ma.example.test"] = ["8.8.8.8"]
    ma_direct._PIN.clear()
    r = _post(c, keys, op="play", item=items["שיר 6"])
    assert (r.status_code, r.json()["code"], r.json()["details"]["state"]) == (503, "ma_unavailable", "host_refused")
    assert "כתובת פרטית" in r.json()["user_message"]


# ------------------------------------------------------------------------------------------------ the transport: checked address, no redirects, hard budget


def _real_transport(monkeypatch, handler) -> list[httpx.Request]:
    seen: list[httpx.Request] = []

    def wrapped(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return handler(request)

    monkeypatch.setattr(ma_direct, "TRANSPORT", [ma_direct.HttpTransport()])
    monkeypatch.setattr(ma_direct, "HTTP_TRANSPORT", [httpx.MockTransport(wrapped)])
    return seen


def _ok(request: httpx.Request) -> httpx.Response:
    if request.url.path == "/info":
        return httpx.Response(200, json={"server_version": "2.10.4", "schema_version": 28})
    return httpx.Response(200, json={"message_id": "x", "result": [{"player_id": "a"}]})


def test_the_call_connects_to_the_checked_address_and_names_the_server_in_the_headers(d, monkeypatch):
    app, c, *_ = d
    seen = _real_transport(monkeypatch, _ok)
    connect(c)
    out = c.post(f"{API}/admin/ma-connection/test").json()
    assert out["state"] == "ready" and out["players"] == 1
    assert {r.url.host for r in seen} == {SERVER_IP}, "never the name: no second, unchecked lookup"
    assert all(r.headers["host"] == "ma.example.test:8095" for r in seen)
    assert seen[0].url.path == "/info" and "authorization" not in seen[0].headers
    assert seen[1].headers["authorization"] == f"Bearer {TOKEN}"
    assert seen[0].extensions.get("sni_hostname") == "ma.example.test"


def test_a_redirect_is_never_followed(d, monkeypatch):
    app, c, *_ = d

    def redirect(request: httpx.Request) -> httpx.Response:
        return httpx.Response(302, headers={"location": "http://127.0.0.1:8095/api"})

    seen = _real_transport(monkeypatch, redirect)
    connect(c)
    assert c.post(f"{API}/admin/ma-connection/test").json()["state"] == "error"
    assert len(seen) == 1 and seen[0].url.host == SERVER_IP


def test_the_transport_refuses_to_run_without_a_checked_address_or_after_the_budget(monkeypatch):
    seen = _real_transport(monkeypatch, _ok)
    t = ma_direct.HttpTransport()
    with pytest.raises(ma_direct.MaError) as no_pin:
        t.info(URL)
    assert no_pin.value.state == "host_refused"
    ma_direct._PINNED.set(SERVER_IP)
    ma_direct._END.set(time.monotonic() - 1)
    with pytest.raises(ma_direct.MaError) as late:
        t.info(URL)
    assert late.value.state == "unreachable" and seen == [], "an exhausted budget sends nothing"


def test_a_trickling_answer_is_cut_at_the_budget(d, monkeypatch):
    app, c, fake, bridge, keys, *_ = d

    class Drip(httpx.SyncByteStream):
        def __iter__(self):
            for _ in range(200):
                time.sleep(0.05)
                yield b" "

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/info":
            return httpx.Response(200, json={"server_version": "x", "schema_version": 28})
        return httpx.Response(200, stream=Drip())

    _real_transport(monkeypatch, handler)
    monkeypatch.setattr(ma_direct, "BUDGET_S", 0.4)
    connect(c)
    t0 = time.monotonic()
    with app.state.db.connection(mode="read") as conn:
        with pytest.raises(ma_direct.MaError) as exc:
            ma_direct.call(conn, "player_queues/get_active_queue", {"player_id": "p"})
    assert exc.value.state == "unreachable" and time.monotonic() - t0 < 3.0


def test_a_server_that_goes_silent_cannot_hold_a_call_past_the_budget(d, monkeypatch):
    """The real socket transport against a throw-away socket in this process: it accepts, answers the headers and then trickles one byte at a time."""
    app, c, *_ = d
    srv = socket.socket()
    srv.bind(("127.0.0.1", 0))
    srv.listen(1)
    port = srv.getsockname()[1]
    stop = threading.Event()

    def serve() -> None:
        try:
            conn, _ = srv.accept()
            conn.recv(4096)
            conn.sendall(b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 1000000\r\n\r\n")
            while not stop.is_set():
                conn.sendall(b" ")
                time.sleep(0.1)
        except OSError:
            pass
        finally:
            srv.close()

    th = threading.Thread(target=serve, daemon=True)
    th.start()
    monkeypatch.setattr(ma_direct, "HTTP_TRANSPORT", [None])  # the real sockets
    t = ma_direct.HttpTransport()
    ma_direct._PINNED.set("127.0.0.1")  # only the test may pin loopback: the address check refuses it for every real call
    ma_direct._END.set(time.monotonic() + 0.6)
    t0 = time.monotonic()
    try:
        with pytest.raises(ma_direct.MaError) as exc:
            t.info(f"http://ma.example.test:{port}")
    finally:
        stop.set()
    assert exc.value.state == "unreachable" and time.monotonic() - t0 < 3.0


def test_the_budget_constants_are_bounded():
    assert ma_direct.BUDGET_S <= 10.0 and ma_direct.RESOLVE_BUDGET_S <= ma_direct.BUDGET_S and ma_direct.PIN_S <= 120


# ------------------------------------------------------------------------------------------------ rates


def test_the_installation_rate_cap_on_rows_stays_and_the_test_route_is_rate_limited(d):
    app, c, fake, *_ = d
    assert media_queue.ROWS_INSTALL == (50.0, 200.0), "50 rows a second per installation (burst 200) must stay"
    connect(c)
    codes = [c.post(f"{API}/admin/ma-connection/test").status_code for _ in range(7)]
    assert codes == [200] * 5 + [429, 429]
    n = len(fake.calls)
    r = c.post(f"{API}/admin/ma-connection/test")
    assert r.status_code == 429 and r.json()["code"] == "rate_limited" and r.json()["details"]["retry_after_s"] >= 1 and len(fake.calls) == n
    rows = [x for x in audit_rows(app, "media.ma_connection") if x["decision"] == "denied"]
    assert rows and rows[-1]["reason"] == "rate_limited"


# ------------------------------------------------------------------------------------------------ RBAC and the remote channel


def test_without_system_configure_the_routes_are_403_before_the_body_is_parsed(d):
    app, c, fake, bridge, keys, settings, _ = d
    connect(c)
    before = len(audit_rows(app, "media.ma_connection"))
    bind(c, settings, "olga", "operator", "installation", "*")
    bind(c, settings, "vera", "viewer", "installation", "*")
    for who in ("olga", "vera"):
        h = as_user(who)
        assert c.get(f"{API}/admin/ma-connection", headers=h).status_code == 403
        r = c.put(f"{API}/admin/ma-connection", headers={**h, "Content-Type": "application/json"}, content=b"{not json at all")
        assert r.status_code == 403, "the permission answers before the body is looked at"
        assert c.post(f"{API}/admin/ma-connection/test", headers=h).status_code == 403
        assert c.put(f"{API}/admin/ma-connection", headers=h, json={"token": TOKEN + "x" * 4, "url": "http://127.0.0.1:1"}).status_code == 403
    assert stored(app)["url"] == URL
    assert c.put(f"{API}/admin/ma-connection", headers={"Content-Type": "application/json"}, content=b"{not json at all").status_code in (400, 422), "an administrator gets the parse error"
    assert len(audit_rows(app, "media.ma_connection")) == before, "a refused caller changed and tested nothing"


def test_the_connection_routes_are_blocked_on_the_remote_channel():
    assert "/api/v1/multimedia/admin/ma-connection" in remote_channel.BLOCKED_ON_REMOTE
    blocked = remote_channel.BLOCKED_ON_REMOTE
    for rest in ("/api/v1/multimedia/admin/ma-connection", "/api/v1/multimedia/admin/ma-connection/test"):
        assert any(rest == b or rest.startswith(b + "/") for b in blocked), rest
    # the queue itself is not blocked (owner decision pending: the plan's question 1)
    assert not any("/api/v1/multimedia/devices/x/queue".startswith(b) for b in blocked)


# ------------------------------------------------------------------------------------------------ nothing leaks


def test_no_token_address_or_ip_in_any_audit_row_or_log_across_the_failures(d, monkeypatch, caplog):
    app, c, fake, bridge, keys, settings, _ = d
    with caplog.at_level(logging.DEBUG):
        connect(c)
        c.post(f"{API}/admin/ma-connection/test")
        for fail in ("unreachable", "unauthorized"):
            fake.fail = fail
            c.post(f"{API}/admin/ma-connection/test")
        fake.fail = None
        c.put(f"{API}/admin/ma-connection", json={"url": "http://127.0.0.1:8095"})
        c.put(f"{API}/admin/ma-connection", json={"clear_token": True})
    blob = json.dumps(audit_rows(app, "media.ma_connection"))
    for secret in (TOKEN, "ma.example", SERVER_IP, "127.0.0.1"):
        assert secret not in blob and secret not in caplog.text, secret
