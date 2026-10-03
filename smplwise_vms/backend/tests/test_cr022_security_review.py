"""CR-022: regression tests for the independent security review of the NN4 backend (findings F1-F16, 2026-10-03).

Every device here is a fake (tests/fixtures/fake_devices.py, httpx MockTransports, a stubbed resolver and interface list);
nothing contacts a real NVR, go2rtc, Home Assistant or any network. Addresses in 192.0.2.0/24 and 198.51.100.0/24 are
RFC 5737 documentation ranges, never routed; the probe is replaced by a recorder wherever such an address could be reached.
The passwords are made-up canaries."""
from __future__ import annotations

import dataclasses
import json
import logging
import zipfile

import httpx
import pytest
from conftest import as_user, png_bytes, seed_tree
from fastapi.testclient import TestClient
from test_nvr_connection import API, CANARY, GOOD, NVR_ADDR, NVR_HOST, OTHER, audit_rows, fake, from_options, j, rows, world  # noqa: F401

from smplwise import capabilities
from smplwise.db import Database, get_setting
from smplwise.main import create_app
from smplwise.services import addon_restart, backup, connection_probe, connection_store
from smplwise.services.recorders import registry


def _recording_probe(monkeypatch, result=None):
    seen: list[str] = []
    answer = result or {"ok": True, "code": "ok", "model": "m", "firmware": "f", "channels": 1}
    monkeypatch.setattr(connection_probe, "probe", lambda cand: seen.append(f"{cand.nvr_host}:{cand.nvr_http_port}:{cand.nvr_password}") or dict(answer))
    return seen


def _store(settings, host, password=CANARY, http_port=80, rtsp_port=554):
    with Database(settings.db_path).connection() as conn:
        return connection_store.write_row(conn, settings, vendor="hikvision", host=host, http_port=http_port, rtsp_port=rtsp_port, username="viewer",
                                          password=password, extra=None, source="ui", actor_id=None)


# ---------------------------------------------------------------- F1: a restore writes only the files its rows reference

def test_f1_restorable_rule():
    for ok in ("plans/a1/page-1.png", "plans/a1/x.stylized.png", "plans/x/y/z.pdf"):
        assert backup.restorable(ok), ok
    for bad in ("keys/connections.key", "plans/keys/x.png", "smplwise.db", "smplwise.db-wal", "plans/a/smplwise.db", "options.json", "plans/options.json",
                "/etc/passwd", "plans/../keys/connections.key", "plans//x.png", "plans/./x.png", "C:/x.png", "plans\\x.png", "plans/x\x00.png",
                "thumbs/a.jpg", "backups/a.zip", "plans/a.key", "", None):
        assert not backup.restorable(bad), bad


def test_f1_a_forged_archive_cannot_replace_the_key_the_database_or_the_options(settings, monkeypatch, caplog):
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    asset = c.post(f"/api/v1/floors/{ids['floor2']}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
    assert c.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset["id"]}).status_code in (200, 201)
    monkeypatch.setattr(connection_probe, "RESOLVE", lambda h: [])
    _store(settings, "192.0.2.80")
    key_before = connection_store.key_path(settings).read_bytes()
    (settings.data_dir / "options.json").write_text('{"keep": "me"}', encoding="utf-8")
    with app.state.db.connection() as conn:
        good = backup.create(settings, conn)
    src = backup.backups_dir(settings) / good["name"]
    forged = backup.backups_dir(settings) / "forged.zip"
    with zipfile.ZipFile(src) as zin, zipfile.ZipFile(forged, "w") as zout:
        for item in zin.infolist():
            body = zin.read(item.filename)
            if item.filename == "data/plan_assets.json":
                assets = json.loads(body)
                assets.append(dict(assets[0], id="evil-key", storage_path="keys/connections.key"))
                assets.append(dict(assets[0], id="evil-opt", storage_path="options.json"))
                assets.append(dict(assets[0], id="evil-db", storage_path=str(settings.db_path)))
                body = json.dumps(assets).encode("utf-8")
            zout.writestr(item, body)
        zout.writestr("files/keys/connections.key", b"K" * 32)
        zout.writestr("files/smplwise.db", b"FORGED-DATABASE")
        zout.writestr("files/smplwise.db-wal", b"FORGED-WAL")
        zout.writestr("files/options.json", b'{"forged": true}')
        zout.writestr("files/plans/../keys/connections.key", b"L" * 32)
        zout.writestr("files/plans/stray-unreferenced.png", b"stray")
        zout.writestr("data/recorder_connections.json", json.dumps([{"recorder_id": "nvr-1", "vendor": "hikvision", "host": "198.51.100.7", "revision": 99}]))
    for mode in ("merge", "replace"):
        with caplog.at_level(logging.WARNING), app.state.db.connection() as conn:
            res = backup.restore(settings, conn, forged, mode=mode)
        assert res["files"] >= 1, "the plan files the archive's rows reference are still restored"
        assert res["files_skipped"] >= 6, res
        assert connection_store.key_path(settings).read_bytes() == key_before, mode
        assert (settings.data_dir / "options.json").read_text(encoding="utf-8") == '{"keep": "me"}', mode
        assert settings.db_path.read_bytes()[:15] == b"SQLite format 3", mode
        assert not (settings.data_dir / "smplwise.db-wal").read_bytes().startswith(b"FORGED") if (settings.data_dir / "smplwise.db-wal").exists() else True
        assert not (settings.data_dir / "plans" / "stray-unreferenced.png").exists(), "an unreferenced archive member is never written"
        (row,) = rows(settings, "SELECT * FROM recorder_connections")
        assert row["host"] == "192.0.2.80" and row["revision"] == 1, "CR-022 section 9: a restore never injects a connection"
        assert rows(settings, "SELECT id FROM plan_assets WHERE id LIKE 'evil-%'") == [], "a row steering a file path outside plans/ is skipped"
        with app.state.db.connection(mode="read") as conn:
            assert connection_store.readable(conn, settings, connection_store.get_row(conn)), "the stored password still decrypts"
    assert "K" * 32 not in caplog.text


# ---------------------------------------------------------------- F2: the stored password goes only where it is stored

def test_f2_the_stored_password_is_never_sent_to_another_destination(world, fake, settings, monkeypatch):
    _, c = world
    assert j(c, "put", json=GOOD).status_code == 200
    seen = _recording_probe(monkeypatch)
    keep = {k: v for k, v in GOOD.items() if k != "password"}
    for change in ({"host": "198.51.100.9"}, {"http_port": 8000}, {"rtsp_port": 10554}):
        r = j(c, "post", API + "/test", json={**keep, **change, "use_stored_password": True})
        assert r.status_code == 422 and r.json()["code"] == "password_required" and r.json()["details"] == {"field": "password", "reason": "destination_changed"}, (change, r.text)
        r = j(c, "put", json={**keep, **change})  # keep_password defaults to true
        assert r.status_code == 422 and r.json()["code"] == "password_required" and r.json()["details"]["reason"] == "destination_changed", (change, r.text)
    assert seen == [], "the stored password never reached a probe of another destination"
    assert rows(settings, "SELECT revision, host FROM recorder_connections") == [{"revision": 1, "host": NVR_HOST}]
    denied = [a for a in audit_rows(settings, "nvr.connection.") if a["decision"] == "denied" and a["reason"] == "destination_changed"]
    assert len(denied) == 6 and all("198.51.100.9" not in (a["details_json"] or "") for a in denied)
    # the same destination keeps working with the stored password; a new destination works with a typed password
    assert j(c, "post", API + "/test", json={**keep, "use_stored_password": True}).json()["ok"] is True
    assert j(c, "put", json=keep).status_code == 200
    assert j(c, "post", API + "/test", json={**keep, "host": "198.51.100.9", "password": OTHER}).json()["ok"] is True
    assert seen == [f"{NVR_ADDR}:80:{CANARY}", f"{NVR_ADDR}:80:{CANARY}", f"198.51.100.9:80:{OTHER}"]


def test_f2_the_legacy_password_is_bound_to_the_legacy_destination(settings, fake, monkeypatch):
    s = from_options(settings)
    c = TestClient(create_app(s))
    with Database(s.db_path).connection() as conn:  # an installation whose import has not happened (the options are in use)
        conn.execute("DELETE FROM recorder_connections")
        conn.execute("DELETE FROM settings WHERE key = ?", (connection_store.IMPORT_DONE_KEY,))
    seen = _recording_probe(monkeypatch)
    keep = {k: v for k, v in GOOD.items() if k != "password"}
    r = c.post(API + "/test", headers=as_user("joni"), json={**keep, "host": "198.51.100.9", "use_stored_password": True})
    assert r.status_code == 422 and r.json()["details"]["reason"] == "destination_changed" and seen == []


# ---------------------------------------------------------------- F3: an unresolved name is never handed to the HTTP client

def test_f3_an_unresolved_name_is_not_connected(world, fake, settings, monkeypatch):
    _, c = world
    seen = _recording_probe(monkeypatch)
    assert connection_probe.connect_target("rebind.test", settings) is None
    r = j(c, "post", API + "/test", json={**GOOD, "host": "rebind.test"})
    assert r.status_code == 200 and r.json() == {"ok": False, "code": "source_unavailable"}
    r = j(c, "put", json={**GOOD, "host": "rebind.test"})
    assert r.status_code == 503 and r.json()["code"] == "source_unavailable" and r.json()["details"]["can_save_untested"] is True
    assert seen == [] and fake.hits == [], "no connection to a name the policy could not check"


# ---------------------------------------------------------------- F4: timeouts, one deadline, a size cap

def _cand(settings, host=NVR_ADDR):
    return connection_probe.candidate(settings, vendor="hikvision", target=host, http_port=80, rtsp_port=554, username="u", password="p")


# C1 control characters are legal XML 1.0 text, so a device can send them (U+009B is the 8-bit terminal escape introducer)
DEVICE_INFO = '<?xml version="1.0"?><DeviceInfo><model>DS\u009b31m-FAKE\u0085</model><firmwareVersion>V1</firmwareVersion></DeviceInfo>'.encode("utf-8")


def test_f4_the_probe_client_has_bounded_timeouts_and_no_redirects(settings):
    with connection_probe.probe_client(_cand(settings)) as client:
        assert client.follow_redirects is False
        assert client.timeout.connect == 5.0 and client.timeout.read == 5.0
    assert connection_probe.DEADLINE_S == 8.0 and connection_probe.MAX_BYTES == 256 * 1024


def test_f4_an_oversized_answer_is_refused_and_device_text_is_cleaned(settings, monkeypatch):
    big = b"<DeviceInfo><model>" + b"x" * (connection_probe.MAX_BYTES + 10) + b"</model></DeviceInfo>"

    def handler(req: httpx.Request) -> httpx.Response:
        if req.url.path == connection_probe.DEVICE_INFO_PATH:
            return httpx.Response(200, content=iter([big[i:i + 4096] for i in range(0, len(big), 4096)]))
        return httpx.Response(404)

    monkeypatch.setattr(connection_probe, "TRANSPORT", httpx.MockTransport(handler))
    assert connection_probe.probe(_cand(settings)) == {"ok": False, "code": "source_error"}
    monkeypatch.setattr(connection_probe, "TRANSPORT", httpx.MockTransport(
        lambda req: httpx.Response(200, headers={"content-length": str(10 ** 9)}, content=b"") if req.url.path == connection_probe.DEVICE_INFO_PATH else httpx.Response(404)))
    assert connection_probe.probe(_cand(settings)) == {"ok": False, "code": "source_error"}, "a declared size over the cap is refused unread"
    monkeypatch.setattr(connection_probe, "TRANSPORT", httpx.MockTransport(
        lambda req: httpx.Response(200, content=DEVICE_INFO) if req.url.path == connection_probe.DEVICE_INFO_PATH else httpx.Response(404)))
    res = connection_probe.probe(_cand(settings))
    assert res == {"ok": True, "code": "ok", "model": "DS31m-FAKE", "firmware": "V1", "channels": None}, "control characters are stripped (F14)"


def test_f4_a_trickling_answer_ends_at_the_deadline(settings, monkeypatch):
    clock = [1000.0]
    monkeypatch.setattr(connection_probe, "CLOCK", lambda: clock[0])

    def trickle():
        for _ in range(10):
            clock[0] += 3.0  # every chunk arrives 3 s after the previous one (each read is within the 5 s read timeout)
            yield b" "
        yield DEVICE_INFO

    monkeypatch.setattr(connection_probe, "TRANSPORT", httpx.MockTransport(lambda req: httpx.Response(200, content=trickle())))
    assert connection_probe.probe(_cand(settings)) == {"ok": False, "code": "timeout"}
    assert clock[0] <= 1000.0 + connection_probe.DEADLINE_S + 3.0, "stopped at the first chunk past the 8 s deadline"


# ---------------------------------------------------------------- F5: the stored host is re-checked at start-up

@pytest.mark.parametrize("host", ["127.0.0.1", "rebind.test", "172.30.32.2"])
def test_f5_a_stored_host_that_fails_the_policy_is_not_used(settings, fake, host):
    fake.resolved["rebind.test"] = ["127.0.0.1"]
    create_app(settings)
    _store(settings, host)
    app = create_app(settings)
    s = app.state.settings
    assert s.nvr_connection_state == "refused" and s.nvr_host is None and s.nvr_password is None and capabilities.nvr_host(s) is None
    c = TestClient(app)
    assert c.get(API, headers=as_user("joni")).json()["state"] == "refused"
    assert c.get("/api/v1/health").json()["nvr"]["state"] == "refused"
    # integration with slice C's restart_pending case: the row loaded at start-up is refused, not "waiting for a restart"
    step = next(s for s in c.get("/api/v1/setup/state", headers=as_user("joni")).json()["steps"] if s["id"] == "nvr")
    assert step["status"] == "failed" and step["problem"]["code"] == "connection_refused"


def test_f5_an_allowed_stored_host_is_used(settings, fake):
    create_app(settings)
    _store(settings, NVR_HOST)
    s = create_app(settings).state.settings
    assert s.nvr_connection_state == "ok" and s.nvr_host == NVR_HOST and s.nvr_password == CANARY


# ---------------------------------------------------------------- F8: IPv6 forms that carry a refused IPv4

@pytest.mark.parametrize("host", ["64:ff9b::7f00:1", "64:ff9b::a9fe:a9fe", "64:ff9b:1::7f00:1", "2002:7f00:1::", "2002:a9fe:a9fe::1", "2002:ac1e:2002::",
                                  "2001:0:4136:e378:8000:63bf:3fff:fdd2", "fec0::1", "::ffff:7f00:1", "64:ff9b::ac1e:2002"])
def test_f8_ipv6_forms_of_refused_addresses_are_refused(settings, fake, host):
    with pytest.raises(Exception) as exc:
        connection_probe.connect_target(host, settings)
    assert getattr(exc.value, "code", None) == "host_refused", host


def test_f8_nat64_of_a_lan_address_stays_allowed(settings, fake):
    assert connection_probe.connect_target("64:ff9b::c0a8:132", settings) == "64:ff9b::c0a8:132"


# ---------------------------------------------------------------- F9: this machine's own addresses and service ports

def test_f9_own_interface_addresses_and_platform_ports_are_refused(world, fake, settings, monkeypatch):
    _, c = world
    monkeypatch.setattr(connection_probe, "LOCAL_ADDRESSES", lambda: {"198.51.100.5", "fd00::77"})
    seen = _recording_probe(monkeypatch)
    for host in ("198.51.100.5", "fd00::77"):
        r = j(c, "post", API + "/test", json={**GOOD, "host": host})
        assert r.status_code == 422 and r.json()["code"] == "host_refused", host
    for port in (8123, 1984, 8554, 8555, 4357, 8099):
        r = j(c, "post", API + "/test", json={**GOOD, "http_port": port})
        assert r.status_code == 422 and r.json()["code"] == "port_refused" and r.json()["details"] == {"field": "http_port"}, port
    r = j(c, "put", json={**GOOD, "rtsp_port": 8554})
    assert r.status_code == 422 and r.json()["code"] == "port_refused" and r.json()["details"] == {"field": "rtsp_port"}
    assert seen == [] and fake.hits == []
    assert any(a["reason"] == "port_refused" for a in audit_rows(settings, "nvr.connection.update"))


def test_f9_interface_listing_reads_local_entries(monkeypatch, tmp_path):
    fib = tmp_path / "fib_trie"
    fib.write_text("Main:\n  +-- 0.0.0.0/0 3 0 5\n     |-- 198.51.100.5\n        /32 host LOCAL\n     |-- 198.51.100.255\n        /32 link BROADCAST\n", encoding="ascii")
    inet6 = tmp_path / "if_inet6"
    inet6.write_text("fd000000000000000000000000000077 02 40 00 80 eth0\n", encoding="ascii")
    real_open = open

    def fake_open(path, *a, **k):
        return real_open({"/proc/net/fib_trie": fib, "/proc/net/if_inet6": inet6}.get(path, path), *a, **k)

    monkeypatch.setattr("builtins.open", fake_open)
    assert connection_probe._interface_addresses() == {"198.51.100.5", "fd00::77"}


# ---------------------------------------------------------------- F6: the add-on restart guard survives the restart

def test_f6_the_restart_guard_is_persisted(world, fake, settings, monkeypatch):
    _, c = world
    calls: list[str] = []
    monkeypatch.setattr(addon_restart, "BASE_URL", "http://fake-supervisor.test")
    monkeypatch.setattr(addon_restart, "TOKEN", "fake-token")
    monkeypatch.setattr(addon_restart, "TRANSPORT", httpx.MockTransport(lambda req: calls.append(req.url.path) or httpx.Response(200, json={})))
    now = [5_000_000.0]
    monkeypatch.setattr(addon_restart, "WALL", lambda: now[0])
    assert j(c, "post", "/api/v1/system/restart", json={"confirm": True}).status_code == 202
    c2 = TestClient(create_app(settings))  # a new process after the restart: no in-memory limiter to rely on
    r = c2.post("/api/v1/system/restart", headers=as_user("joni"), json={"confirm": True})
    assert r.status_code == 429 and r.json()["code"] == "rate_limited" and calls == ["/addons/self/restart"]
    now[0] += addon_restart.WINDOW_S + 1
    assert c2.post("/api/v1/system/restart", headers=as_user("joni"), json={"confirm": True}).status_code == 202
    now[0] -= 10_000  # a clock that went backwards never blocks
    assert c2.post("/api/v1/system/restart", headers=as_user("joni"), json={"confirm": True}).status_code == 202
    assert addon_restart.LAST_KEY in backup.SETTINGS_KEEP


# ---------------------------------------------------------------- F7: refusals of a save are audited

def test_f7_a_refused_host_on_save_is_audited_without_the_host(world, fake, settings):
    _, c = world
    r = j(c, "put", json={**GOOD, "host": "127.0.0.1"})
    assert r.status_code == 422 and r.json()["code"] == "host_refused"
    denied = [a for a in audit_rows(settings, "nvr.connection.update") if a["decision"] == "denied"]
    assert [a["reason"] for a in denied] == ["host_refused"] and "127.0.0.1" not in denied[0]["details_json"]
    assert json.loads(denied[0]["details_json"]) == {"vendor": "hikvision", "outcome": "host_refused"}


# ---------------------------------------------------------------- F10: if_revision is mandatory and checked under the lock

def test_f10_if_revision_is_required(world, fake, settings):
    _, c = world
    r = j(c, "put", auto_revision=False, json=GOOD)
    assert r.status_code == 422 and r.json()["code"] == "revision_required" and r.json()["details"] == {"field": "if_revision"}
    r = j(c, "put", auto_revision=False, json={"vendor": "none"})
    assert r.status_code == 422 and r.json()["code"] == "revision_required"
    assert j(c, "put", json=GOOD).status_code == 200
    r = j(c, "delete", auto_revision=False, json={"confirm_text": "הסר"})
    assert r.status_code == 422 and r.json()["code"] == "revision_required"
    r = j(c, "delete", json={"confirm_text": "הסר", "if_revision": 0})
    assert r.status_code == 409 and r.json()["code"] == "stale" and r.json()["details"] == {"revision": 1}
    assert j(c, "delete", json={"confirm_text": "הסר", "if_revision": 1}).status_code == 200
    assert fake.hits == [] or all(" GET " in h for h in fake.hits)


def test_f10_an_edit_made_while_the_probe_ran_wins_over_a_stale_save(world, fake, settings, monkeypatch):
    _, c = world

    def concurrent_probe(cand):
        _store(settings, "198.51.100.20", password=OTHER)  # another administrator saves while this request's lock is released
        return {"ok": True, "code": "ok", "model": "m", "firmware": "f", "channels": 1}

    monkeypatch.setattr(connection_probe, "probe", concurrent_probe)
    r = j(c, "put", json={**GOOD, "if_revision": 0})
    assert r.status_code == 409 and r.json()["code"] == "stale" and r.json()["details"] == {"revision": 1}
    assert rows(settings, "SELECT host, revision FROM recorder_connections") == [{"host": "198.51.100.20", "revision": 1}], "the other edit is kept"


# ---------------------------------------------------------------- F11: the legacy plaintext file is wiped

def test_f11_the_legacy_connection_file_is_wiped_and_deleted(settings, fake, caplog):
    caplog.set_level(logging.DEBUG)
    legacy = settings.data_dir / "nvr_connection.json"
    legacy.parent.mkdir(parents=True, exist_ok=True)
    legacy.write_text(json.dumps({"nvr_host": NVR_HOST, "nvr_password": CANARY}), encoding="utf-8")
    create_app(settings)
    assert not legacy.exists()
    assert CANARY not in caplog.text and "legacy NVR connection file" in caplog.text
    create_app(settings)  # idempotent
    assert connection_store.remove_legacy_file(settings) is False


# ---------------------------------------------------------------- F13: key file mode and directory flush

def test_f13_a_loose_key_file_mode_is_tightened_and_the_directory_is_flushed(settings, monkeypatch):
    synced: list[str] = []
    monkeypatch.setattr(connection_store, "_POSIX", True)
    monkeypatch.setattr(connection_store, "_fsync_dir", lambda d: synced.append(d.name))
    blob = connection_store.encrypt(settings, "nvr-1", "password", CANARY)
    assert synced == ["keys"], "the new key's directory entry is flushed"
    p = connection_store.key_path(settings)
    chmods: list[tuple[str, int]] = []
    real_stat = connection_store.os.stat
    monkeypatch.setattr(connection_store.os, "stat", lambda path, *a, **k: type("S", (), {"st_mode": 0o100644})() if str(path) == str(p) else real_stat(path, *a, **k))
    monkeypatch.setattr(connection_store.os, "chmod", lambda path, mode: chmods.append((str(path), mode)))
    assert connection_store.decrypt(settings, "nvr-1", "password", blob) == CANARY
    assert chmods == [(str(p), 0o600)]


# ---------------------------------------------------------------- F14: no control characters in the user name

def test_f14_a_user_name_with_control_characters_is_refused(world, fake):
    _, c = world
    for name in ("view\x07er", "view\ner", "a\x1bb", "x\x85y"):
        r = j(c, "put", json={**GOOD, "username": name})
        assert r.status_code == 422 and r.json()["code"] == "username_invalid", repr(name)
    assert fake.hits == []


# ---------------------------------------------------------------- F16: the import takes only what the options file carried

def test_f16_the_import_never_takes_an_environment_password(settings, fake):
    s = from_options(settings, nvr_option_keys=frozenset({"nvr_host", "nvr_username"}))  # the password came from NVR_PASSWORD
    create_app(s)
    (row,) = rows(s, "SELECT * FROM recorder_connections")
    assert row["password_enc"] is None and row["state"] == "incomplete"
    (imp,) = audit_rows(s, "nvr.connection.import")
    assert json.loads(imp["details_json"])["password_imported"] is False


def test_f16_an_invalid_legacy_host_is_not_imported(settings, fake, caplog):
    caplog.set_level(logging.DEBUG)
    s = from_options(settings, nvr_host="http://nvr.example:90")
    app = create_app(s)
    assert rows(s, "SELECT * FROM recorder_connections") == []
    with Database(s.db_path).connection(mode="read") as conn:
        assert get_setting(conn, connection_store.IMPORT_DONE_KEY) is None, "nothing written: the options stay in use"
    assert app.state.settings.nvr_host == "http://nvr.example:90" and "not imported" in caplog.text and CANARY not in caplog.text
    assert registry.DEFAULT_VENDOR == "hikvision"
