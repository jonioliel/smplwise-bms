"""CR-022 slice B: the NVR connection stored in Arx (docs/changes/CR-022-NVR-CONNECTION-IN-ARX.md section 16, AT-022-01 ... 20).

Every device here is a fake: the NVR and go2rtc of tests/fixtures/fake_devices.py (reserved `.test` names, answered on httpx's
transport), a MockTransport standing in for the add-on Supervisor, and a stubbed resolver (no DNS from a test). The password used
below is a made-up canary, scanned for in every answer, audit row, log record and archive."""
from __future__ import annotations

import dataclasses
import json
import logging
import re
import sqlite3
import sys
import zipfile
from pathlib import Path

import httpx
import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.db import Database, get_setting, now_iso
from smplwise.main import create_app
from smplwise.mode import HA_ONLY, installation_mode
from smplwise.services import addon_restart, autosync, backup, connection_probe, connection_store, nvr
from smplwise.services import go2rtc as g2
from smplwise.services import setup_wizard as wizard
from smplwise.services.recorders import registry

sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from fake_devices import GO2RTC_HOST, NVR_ADDR, NVR_HOST, FakeDevices  # noqa: E402

API = "/api/v1/nvr/connection"
CANARY = "Canary-Pw-7Q9z"  # a made-up test value, never a real credential
OTHER = "Other-Pw-4K2m"
OWN_HOST = "arx-test-host"
GOOD = {"vendor": "hikvision", "host": NVR_HOST, "http_port": 80, "rtsp_port": 554, "username": "viewer", "password": CANARY}


@pytest.fixture()
def fake(monkeypatch):
    f = FakeDevices()
    f.install(monkeypatch)
    resolved: dict[str, list[str]] = {NVR_HOST: [NVR_ADDR]}  # review F3: only a resolved, checked address is ever connected
    monkeypatch.setattr(connection_probe, "RESOLVE", lambda h: list(resolved.get(h, [])))
    monkeypatch.setattr(connection_probe, "HOSTNAME", lambda: OWN_HOST)
    monkeypatch.setattr(connection_probe, "LOCAL_ADDRESSES", lambda: set(), raising=False)  # no interface listing from a test
    f.resolved = resolved  # type: ignore[attr-defined]
    monkeypatch.setattr(addon_restart, "BASE_URL", None)
    monkeypatch.setattr(addon_restart, "TOKEN", None)
    monkeypatch.setattr(addon_restart, "TRANSPORT", None)
    monkeypatch.delenv("SUPERVISOR_TOKEN", raising=False)
    return f


@pytest.fixture()
def world(settings, fake):
    """joni = system administrator (bootstrap); vera viewer, olga operator, sam site admin (installation), nobody unbound."""
    app = create_app(settings)
    c = TestClient(app)
    assert c.get("/api/v1/me", headers=as_user("joni")).status_code == 200
    for name, role in (("vera", "viewer"), ("olga", "operator"), ("sam", "site_admin")):
        bind(c, settings, name, role, "installation", "*")
    c.get("/api/v1/me", headers=as_user("nobody"))
    return app, c


def j(c, method, path=API, user="joni", auto_revision=True, **kw):
    """A request as `user`. PUT / DELETE on the connection carry the current `if_revision` (mandatory since review F10)
    unless the body names one or `auto_revision=False`."""
    body = kw.get("json")
    if auto_revision and path == API and method in ("put", "delete") and isinstance(body, dict) and "if_revision" not in body:
        kw["json"] = {**body, "if_revision": c.get(API, headers=as_user("joni")).json().get("revision") or 0}
    return c.request(method, path, headers=as_user(user), **kw)


def rows(settings, sql, args=()):
    with Database(settings.db_path).connection(mode="read") as conn:
        return [dict(r) for r in conn.execute(sql, args).fetchall()]


def audit_rows(settings, prefix=""):
    return rows(settings, "SELECT action, decision, reason, details_json FROM audit_log WHERE action LIKE ? ORDER BY id", (prefix + "%",))


def add_camera(settings, cid="cam1", channel=1):
    with Database(settings.db_path).connection() as conn:
        autosync.ensure_recorder(conn)
        now = now_iso()
        conn.execute("INSERT INTO cameras(id, recorder_id, channel, name_source, sort_order, main_track, sub_track, capabilities_json, status, created_at, updated_at) "
                     "VALUES (?, ?, ?, 'שער', 1, 101, 102, '{}', 'online', ?, ?)", (cid, registry.DEFAULT_RECORDER, channel, now, now))


def from_options(settings, **kw):
    """Settings as load_settings builds them from an add-on options file that names an NVR."""
    base = {"nvr_host": NVR_HOST, "nvr_user": "viewer", "nvr_password": CANARY, "nvr_from_options": True, "go2rtc_url": f"http://{GO2RTC_HOST}:1984",
            "nvr_option_keys": frozenset({"nvr_host", "nvr_username", "nvr_password"})}
    return dataclasses.replace(settings, **{**base, **kw})


# ---------------------------------------------------------------- AT-022-01 encryption

def test_encrypt_round_trip_and_every_failure_closes(settings):
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    blob = connection_store.encrypt(settings, "nvr-1", "password", CANARY)
    assert blob.startswith("v1:") and CANARY not in blob
    assert connection_store.decrypt(settings, "nvr-1", "password", blob) == CANARY
    assert connection_store.encrypt(settings, "nvr-1", "password", CANARY) != blob, "a fresh nonce per encryption"
    raw = bytearray(__import__("base64").b64decode(blob[3:]))
    raw[-1] ^= 1
    tampered = "v1:" + __import__("base64").b64encode(bytes(raw)).decode()
    for rid, field, b in (("nvr-1", "password", tampered), ("nvr-2", "password", blob), ("nvr-1", "secret_json", blob), ("nvr-1", "password", "v0:" + blob[3:]),
                          ("nvr-1", "password", "v1:!!notbase64"), ("nvr-1", "password", "v1:")):
        with pytest.raises(connection_store.SecretError) as exc:
            connection_store.decrypt(settings, rid, field, b)
        assert CANARY not in str(exc.value)
    key = connection_store.key_path(settings)
    assert key.parent.name == "keys" and len(key.read_bytes()) == 32
    key.write_bytes(b"\x00" * 32)  # another key
    with pytest.raises(connection_store.SecretError):
        connection_store.decrypt(settings, "nvr-1", "password", blob)
    key.unlink()  # key lost: never re-created by a read
    with pytest.raises(connection_store.SecretError):
        connection_store.decrypt(settings, "nvr-1", "password", blob)
    assert not key.exists()
    key.write_bytes(b"short")
    with pytest.raises(connection_store.SecretError):
        connection_store.encrypt(settings, "nvr-1", "password", CANARY)
    with pytest.raises(connection_store.SecretError):
        connection_store.encrypt(settings, "nvr-1", "host", "x")  # only the secret fields are ever encrypted


def test_key_creation_race_uses_the_winners_key(settings, monkeypatch):
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    winner = b"W" * 32
    real_link = connection_store.os.link

    def racing_link(src, dst):  # another process places its key between our existence check and our link
        Path(dst).write_bytes(winner)
        return real_link(src, dst)

    monkeypatch.setattr(connection_store.os, "link", racing_link)
    assert connection_store._load_or_create_key(settings, create=True) == winner
    assert connection_store.key_path(settings).read_bytes() == winner
    assert not list(connection_store.key_path(settings).parent.glob(".connections.key.*.tmp")), "no temporary file left behind"


# ---------------------------------------------------------------- AT-022-03 catalogue and GET shape

def test_vendor_catalogue_hikvision_and_none_selectable_others_coming_soon(world):
    _, c = world
    r = j(c, "get", "/api/v1/nvr/vendors")
    assert r.status_code == 200
    by = {v["id"]: v for v in r.json()["vendors"]}
    assert [v["id"] for v in r.json()["vendors"]] == ["hikvision", "provision_isr", "frigate", "none"]
    assert by["hikvision"]["status"] == "available" and by["none"]["status"] == "available"
    assert by["provision_isr"]["status"] == "planned" and by["frigate"]["status"] == "planned"
    assert by["hikvision"]["default_ports"] == {"http_port": 80, "rtsp_port": 554}
    fields = {f["key"]: f for f in by["hikvision"]["fields"]}
    assert fields["password"]["secret"] is True and fields["password"]["kind"] == "password" and not fields["host"]["secret"]
    for word in ("Home Assistant", "Add-on", "add-on", "Ingress", "Supervisor"):
        assert word not in r.text


def test_get_connection_shape_has_no_password_and_keeps_the_0171_keys(world, fake):
    app, c = world
    v = j(c, "get").json()
    for key in ("host", "placeholder", "http_port", "rtsp_port", "user", "has_password", "in_addon", "vendor", "username", "extra", "state", "source",
                "revision", "updated_at", "updated_by", "pending_restart", "legacy_options_differ", "restart"):
        assert key in v, key
    assert v["placeholder"] is True and v["host"] is None and v["state"] == "not_chosen" and v["pending_restart"] is False
    assert j(c, "put", json=GOOD).status_code == 200
    v = j(c, "get").json()
    assert v["vendor"] == "hikvision" and v["host"] == NVR_HOST and v["username"] == v["user"] == "viewer" and v["has_password"] is True
    assert v["state"] == "ok" and v["source"] == "ui" and v["revision"] == 1 and v["pending_restart"] is True and v["updated_by"]
    assert "password" not in v and "password_enc" not in v and CANARY not in json.dumps(v) and "v1:" not in json.dumps(v)


# ---------------------------------------------------------------- AT-022-04 permissions first

ROUTES = [("get", "/api/v1/nvr/vendors"), ("get", API), ("put", API), ("delete", API), ("post", API + "/test"), ("post", "/api/v1/system/restart")]


def test_every_route_is_the_system_admins_alone_checked_before_the_body(world, fake, settings):
    _, c = world
    before = len(audit_rows(settings))
    for user in ("vera", "olga", "sam", "nobody"):
        for method, path in ROUTES:
            # a malformed body: the 403 must come first (never a 422 that tells the caller anything)
            r = c.request(method, path, headers={**as_user(user), "Content-Type": "application/json"}, content=b"{not json")
            assert r.status_code == 403 and r.json()["code"] == "forbidden", (user, method, path, r.status_code)
    denied = [a for a in audit_rows(settings)[before:] if a["decision"] == "denied" and a["action"] == "system.configure"]
    assert len(denied) == 4 * len(ROUTES), "every refusal is audited"
    assert fake.hits == [], "a refused caller never reaches the NVR"
    assert rows(settings, "SELECT * FROM recorder_connections") == []


def test_only_the_system_admin_holds_system_configure_and_no_custom_role_can(world):
    _, c = world
    roles = json.loads((Path(connection_store.__file__).resolve().parents[1] / "roles.json").read_text(encoding="utf-8"))["roles"]
    assert [r["id"] for r in roles if "system.configure" in r["permissions"]] == ["system_admin"]
    r = j(c, "post", "/api/v1/access/roles", json={"name": "מתקין", "description": "x", "permissions": ["map.read", "system.configure"], "sensitive": []})
    assert r.status_code == 422 and r.json()["code"] == "system_permission_not_allowed"
    r = j(c, "post", "/api/v1/access/roles", json={"name": "מתקין", "description": "x", "permissions": ["map.read"], "sensitive": ["system.configure"]})
    assert r.status_code == 422 and r.json()["code"] == "system_permission_not_allowed"


# ---------------------------------------------------------------- AT-022-05 validation

@pytest.mark.parametrize("body,code", [
    ({**GOOD, "host": "http://nvr.test"}, "host_invalid"),
    ({**GOOD, "host": "nvr.test/ISAPI"}, "host_invalid"),
    ({**GOOD, "host": "admin@nvr.test"}, "host_invalid"),
    ({**GOOD, "host": "nvr.test:8080"}, "host_invalid"),
    ({**GOOD, "host": "nvr .test"}, "host_invalid"),
    ({**GOOD, "host": "a" * 254}, "host_invalid"),
    ({**GOOD, "host": "[fd00::1]"}, "host_invalid"),
    ({**GOOD, "host": ""}, "host_invalid"),
    ({**GOOD, "http_port": 0}, "port_invalid"),
    ({**GOOD, "rtsp_port": 70000}, "port_invalid"),
    ({**GOOD, "vendor": "provision_isr"}, "vendor_not_available"),
    ({**GOOD, "vendor": "frigate"}, "vendor_not_available"),
    ({**GOOD, "vendor": "dahua"}, "vendor_not_available"),
    ({**GOOD, "username": ""}, "username_required"),
    ({**GOOD, "extra": {"onvif_port": 80}}, "extra_invalid"),
    ({**GOOD, "unexpected": 1}, "validation"),
    ({**GOOD, "password": "x" * 129}, "validation"),
])
def test_put_validation_codes(world, fake, body, code):
    _, c = world
    r = j(c, "put", json=body)
    assert r.status_code == 422 and r.json()["code"] == code, r.text
    assert fake.hits == []


def test_bodies_must_be_json(world, fake):
    _, c = world
    r = c.put(API, headers={**as_user("joni"), "Content-Type": "text/plain"}, content=json.dumps(GOOD).encode())
    assert r.status_code == 415
    r = c.put(API, headers={**as_user("joni"), "Content-Type": "application/json"}, content=b"[1, 2]")
    assert r.status_code == 422


# ---------------------------------------------------------------- AT-022-06 the test endpoint

def test_connection_test_reads_only_and_answers_coarsely(world, fake, settings):
    _, c = world
    r = j(c, "post", API + "/test", json=GOOD)
    assert r.status_code == 200, r.text
    assert r.json() == {"ok": True, "code": "ok", "model": "DS-7616NI-FAKE", "firmware": "V4.84.000 fake", "channels": 4}
    assert fake.writes == [] and fake.hits and all(" GET " in h for h in fake.hits), fake.hits
    assert rows(settings, "SELECT * FROM recorder_connections") == [], "a test never stores anything"
    tests = audit_rows(settings, "nvr.connection.test")
    assert len(tests) == 1 and json.loads(tests[0]["details_json"]) == {"vendor": "hikvision", "outcome": "ok"}
    fake.nvr["auth"] = False
    r = j(c, "post", API + "/test", json=GOOD)
    assert r.json() == {"ok": False, "code": "source_forbidden"}
    fake.nvr["auth"] = True
    fake.nvr["up"] = False
    r = j(c, "post", API + "/test", json=GOOD)
    assert r.json() == {"ok": False, "code": "source_unavailable"} and NVR_HOST not in r.text
    assert fake.writes == []


def test_connection_test_needs_a_password_or_the_stored_one(world, fake):
    _, c = world
    body = {k: v for k, v in GOOD.items() if k != "password"}
    assert j(c, "post", API + "/test", json=body).json()["code"] == "password_required"
    assert j(c, "put", json=GOOD).status_code == 200
    r = j(c, "post", API + "/test", json={**body, "use_stored_password": True})
    assert r.status_code == 200 and r.json()["ok"] is True


# ---------------------------------------------------------------- AT-022-07 SSRF source policy

@pytest.mark.parametrize("host", ["127.0.0.1", "127.1", "0x7f.1", "2130706433", "localhost", "nvr.localhost", "::1", "::ffff:127.0.0.1", "0.0.0.0",
                                  "169.254.169.254", "fe80::1", "224.0.0.1", "supervisor", "homeassistant", "172.30.32.2", "172.30.33.5", OWN_HOST,
                                  "loop.test", "meta.test"])
def test_refused_hosts_are_never_contacted(world, fake, settings, host):
    _, c = world
    fake.resolved.update({"loop.test": ["127.0.0.1"], "meta.test": ["192.168.1.9", "169.254.169.254"]})
    for method, path in (("post", API + "/test"), ("put", API)):
        r = j(c, method, path, json={**GOOD, "host": host})
        assert r.status_code == 422 and r.json()["code"] in ("host_refused", "host_invalid"), (host, r.text)
        assert host not in json.dumps(r.json()["details"])
    r = j(c, "put", json={**GOOD, "host": host, "save_untested": True, "confirm_text": "שמור"})
    assert r.status_code == 422, "a refused host is never saved, not even untested"
    assert fake.hits == [] and rows(settings, "SELECT * FROM recorder_connections") == []


def test_lan_addresses_are_allowed_and_a_name_is_connected_by_its_checked_address(world, fake, settings, monkeypatch):
    _, c = world
    seen: list[str] = []
    monkeypatch.setattr(connection_probe, "probe", lambda cand: seen.append(cand.nvr_host) or {"ok": True, "code": "ok", "model": "m", "firmware": "f", "channels": 1})
    fake.resolved["nvr.lan.test"] = ["192.168.1.60"]
    for host in ("192.168.1.50", "10.0.0.7", "nvr.lan.test", "fd00::10"):
        r = j(c, "post", API + "/test", json={**GOOD, "host": host})
        assert r.status_code == 200 and r.json()["ok"] is True, (host, r.text)
    assert seen == ["192.168.1.50", "10.0.0.7", "192.168.1.60", "[fd00::10]"], "the probe goes to the checked address (no second resolution)"


def test_the_nvr_client_never_follows_a_redirect(settings):
    cand = connection_probe.candidate(settings, vendor="hikvision", target="192.168.1.50", http_port=80, rtsp_port=554, username="u", password="p")
    with nvr._client(cand) as client:
        assert client.follow_redirects is False


# ---------------------------------------------------------------- AT-022-08 rate limit

def test_connection_tests_are_rate_limited_and_audited(world, fake, settings):
    _, c = world
    for _ in range(5):
        assert j(c, "post", API + "/test", json=GOOD).status_code == 200
    r = j(c, "post", API + "/test", json=GOOD)
    assert r.status_code == 429 and r.json()["code"] == "rate_limited" and r.json()["details"]["retry_after_s"] >= 1
    assert any(a["decision"] == "denied" and a["reason"] == "rate_limited" for a in audit_rows(settings, "nvr.connection.test"))
    lim = connection_probe.Limiter(per_user=5, total=20, window_s=60)
    assert all(lim.take(f"u{i % 10}", now=100.0) == 0 for i in range(20)) and lim.take("u-new", now=100.0) > 0, "20 a minute per installation"
    assert lim.take("u-new", now=161.0) == 0, "the window slides"


# ---------------------------------------------------------------- AT-022-09 / 10 the one-time import

def test_options_are_imported_once_and_the_installation_behaves_as_before(settings, fake, caplog):
    caplog.set_level(logging.DEBUG)
    s = from_options(settings)
    app = create_app(s)
    (row,) = rows(s, "SELECT * FROM recorder_connections")
    assert row["source"] == "addon_import" and row["vendor"] == "hikvision" and row["host"] == NVR_HOST and row["revision"] == 1 and row["state"] == "ok"
    assert row["password_enc"].startswith("v1:") and CANARY not in json.dumps(row)
    eff = app.state.settings
    assert (eff.nvr_host, eff.nvr_user, eff.nvr_password, eff.nvr_connection_revision) == (NVR_HOST, "viewer", CANARY, 1)
    assert installation_mode(eff) == "full"
    imports = audit_rows(s, "nvr.connection.import")
    assert len(imports) == 1 and CANARY not in imports[0]["details_json"]
    with Database(s.db_path).connection(mode="read") as conn:
        assert get_setting(conn, connection_store.IMPORT_DONE_KEY) == "1"
    create_app(s)  # the next start-up
    assert len(rows(s, "SELECT * FROM recorder_connections")) == 1 and rows(s, "SELECT revision FROM recorder_connections")[0]["revision"] == 1
    assert len(audit_rows(s, "nvr.connection.import")) == 1, "idempotent"
    assert CANARY not in caplog.text and NVR_HOST not in caplog.text


def test_import_edge_cases(settings, fake, monkeypatch):
    # the developer placeholder is never imported; neither are NVR_* environment values (not from the options file)
    placeholder = create_app(from_options(settings, nvr_host="nvr-placeholder.test", data_dir=settings.data_dir.parent / "p"))
    assert rows(placeholder.state.settings, "SELECT * FROM recorder_connections") == []
    env = create_app(from_options(settings, nvr_from_options=False, data_dir=settings.data_dir.parent / "e"))
    assert rows(env.state.settings, "SELECT * FROM recorder_connections") == [] and env.state.settings.nvr_host == NVR_HOST
    # a host without a password imports as incomplete
    nopw = create_app(from_options(settings, nvr_password=None, data_dir=settings.data_dir.parent / "n"))
    (row,) = rows(nopw.state.settings, "SELECT * FROM recorder_connections")
    assert row["state"] == "incomplete" and row["password_enc"] is None
    # the key cannot be created: nothing written, the options stay in use
    monkeypatch.setattr(connection_store, "encrypt", lambda *a, **k: (_ for _ in ()).throw(connection_store.SecretError("no key")))
    broken = from_options(settings, data_dir=settings.data_dir.parent / "k")
    app = create_app(broken)
    assert rows(broken, "SELECT * FROM recorder_connections") == []
    with Database(broken.db_path).connection(mode="read") as conn:
        assert get_setting(conn, connection_store.IMPORT_DONE_KEY) is None
    assert app.state.settings.nvr_host == NVR_HOST and app.state.settings.nvr_password == CANARY and app.state.settings.nvr_connection_revision is None


def test_remove_nvr_is_never_undone_by_the_old_options(settings, fake):
    s = from_options(settings)
    c = TestClient(create_app(s))
    r = j(c, "delete", json={"confirm_text": "הסר"})
    assert r.status_code == 200 and r.json()["removed"] is True and r.json()["restart_required"] is True
    restarted = create_app(s)
    (row,) = rows(s, "SELECT * FROM recorder_connections")
    assert row["vendor"] == "none" and row["password_enc"] is None and row["host"] is None
    assert installation_mode(restarted.state.settings) == HA_ONLY and restarted.state.settings.nvr_password is None
    assert restarted.state.legacy_options_differ is True, "the old options still name an NVR: ignored, one neutral note"


def test_legacy_options_naming_another_host_are_ignored_and_reported(settings, fake, caplog):
    s = from_options(settings, nvr_host="options-nvr.test")  # imported first, then changed in Arx to the fake NVR
    c = TestClient(create_app(s))
    assert c.app.state.legacy_options_differ is False
    assert j(c, "put", json=GOOD).status_code == 200
    caplog.set_level(logging.WARNING)
    app = create_app(s)
    assert rows(s, "SELECT host FROM recorder_connections")[0]["host"] == NVR_HOST and app.state.settings.nvr_host == NVR_HOST
    assert app.state.legacy_options_differ is True and "legacy add-on NVR options are ignored" in caplog.text
    assert j(TestClient(app), "get").json()["legacy_options_differ"] is True


# ---------------------------------------------------------------- AT-022-11 precedence and safe states

def test_precedence_row_over_options_over_env(settings, fake):
    s = from_options(settings, nvr_host="options-nvr.test")
    assert connection_store.overlay(s, None) is s, "no row: the options / environment stay"
    c = TestClient(create_app(dataclasses.replace(settings, go2rtc_url=f"http://{GO2RTC_HOST}:1984")))
    assert j(c, "put", json=GOOD).status_code == 200
    with Database(settings.db_path).connection(mode="read") as conn:
        row = connection_store.get_row(conn)
    eff = connection_store.overlay(s, row)
    assert eff.nvr_host == NVR_HOST and eff.nvr_password == CANARY and eff.nvr_vendor == "hikvision" and eff.nvr_connection_state == "ok"
    caps = __import__("smplwise.capabilities", fromlist=["resolve"]).resolve(eff)
    assert caps.nvr is True and caps.recorders[0].vendor == "hikvision"


def test_no_nvr_choice_is_ha_only(world, fake, settings):
    _, c = world
    r = j(c, "put", json={"vendor": "none"})
    assert r.status_code == 200 and r.json()["vendor"] == "none" and fake.hits == []
    app = create_app(settings)
    eff = app.state.settings
    assert installation_mode(eff) == HA_ONLY and eff.nvr_vendor == "none" and eff.nvr_host is None
    assert TestClient(app).get("/api/v1/me").json()["mode"] == HA_ONLY


def test_a_just_saved_connection_leaves_the_nvr_step_todo_until_the_restart(world, fake, settings):
    """Slice C finding: a saved, readable connection of an installation that started without an NVR is waiting for the restart -
    the wizard step must say so (todo, `restart_pending`), not claim the stored details are unreadable."""
    world  # the administrator exists in the database
    c = TestClient(create_app(dataclasses.replace(settings, nvr_host=None, nvr_password=None, nvr_from_options=False)))  # a start-up without an NVR
    assert j(c, "get", "/api/v1/me").json()["mode"] == HA_ONLY
    assert j(c, "put", json=GOOD).status_code == 200
    step = next(s for s in c.get("/api/v1/setup/state", headers=as_user("joni")).json()["steps"] if s["id"] == "nvr")
    assert step["status"] == "todo" and step["problem"]["code"] == "restart_pending"
    assert "ממתינים" in step["facts"][0]["value"]


def test_an_unreadable_connection_fails_closed_and_start_up_completes(world, fake, settings):
    _, c = world
    assert j(c, "put", json=GOOD).status_code == 200
    connection_store.key_path(settings).unlink()  # the key is lost (restored without it, copied DB ...)
    app = create_app(settings)
    eff = app.state.settings
    assert eff.nvr_connection_state == "unreadable" and eff.nvr_password is None and installation_mode(eff) == HA_ONLY
    c2 = TestClient(app)
    h = c2.get("/api/v1/health").json()
    assert h["nvr"]["state"] == "unreadable"
    v = j(c2, "get").json()
    assert v["state"] == "unreadable" and v["has_password"] is False
    step = next(s for s in c2.get("/api/v1/setup/state").json()["steps"] if s["id"] == "nvr")
    assert step["status"] == "failed" and step["problem"]["code"] == "connection_unreadable"
    # entering the password again repairs it
    assert j(c2, "put", json=GOOD).status_code == 200
    assert create_app(settings).state.settings.nvr_connection_state == "ok"


# ---------------------------------------------------------------- AT-022-12 restart semantics

def test_save_needs_a_restart_and_the_flag_survives_until_then(world, fake, settings):
    app, c = world
    before = app.state.settings
    r = j(c, "put", json=GOOD)
    assert r.status_code == 200 and r.json()["restart_required"] is True and r.json()["revision"] == 1
    assert app.state.settings is before, "never swapped in-process"
    assert j(c, "get", "/api/v1/me").json()["connection_pending_restart"] is True
    assert "connection_pending_restart" not in j(c, "get", "/api/v1/me", "vera").json(), "for the system administrator only"
    assert j(c, "get", "/api/v1/health").json()["connection_pending_restart"] is True
    assert j(c, "put", json={**GOOD, "if_revision": 0}).json()["code"] == "stale"
    assert j(c, "put", json={**GOOD, "if_revision": 1}).json()["revision"] == 2
    restarted = TestClient(create_app(settings))
    assert j(restarted, "get", "/api/v1/me").json()["connection_pending_restart"] is False
    assert restarted.app.state.settings.nvr_host == NVR_HOST and restarted.app.state.settings.nvr_connection_revision == 2


# ---------------------------------------------------------------- AT-022-13 offline save

def test_an_unreachable_nvr_is_saved_only_with_the_typed_confirmation(world, fake, settings):
    _, c = world
    fake.nvr["up"] = False
    r = j(c, "put", json=GOOD)
    assert r.status_code == 503 and r.json()["code"] == "source_unavailable" and r.json()["details"]["can_save_untested"] is True
    r = j(c, "put", json={**GOOD, "save_untested": True})
    assert r.status_code == 422 and r.json()["code"] == "confirm_required"
    r = j(c, "put", json={**GOOD, "save_untested": True, "confirm_text": "save"})
    assert r.status_code == 422 and r.json()["code"] == "confirm_required"
    assert rows(settings, "SELECT * FROM recorder_connections") == []
    r = j(c, "put", json={**GOOD, "save_untested": True, "confirm_text": "שמור"})
    assert r.status_code == 200 and r.json()["untested"] is True and r.json()["device"] is None
    upd = [json.loads(a["details_json"]) for a in audit_rows(settings, "nvr.connection.update") if a["decision"] == "allowed"]
    assert upd[-1]["untested"] is True and upd[-1]["password_changed"] is True
    # bad credentials are never saved untested
    fake.nvr["up"] = True
    fake.nvr["auth"] = False
    r = j(c, "put", json={**GOOD, "password": OTHER, "save_untested": True, "confirm_text": "שמור"})
    assert r.status_code == 502 and r.json()["code"] == "source_forbidden" and r.json()["details"]["can_save_untested"] is False
    assert rows(settings, "SELECT revision FROM recorder_connections")[0]["revision"] == 1
    assert fake.writes == []


# ---------------------------------------------------------------- AT-022-14 vendor change and Remove NVR

def test_vendor_change_with_cameras_needs_remove_first(world, fake, settings):
    _, c = world
    assert j(c, "put", json=GOOD).status_code == 200
    add_camera(settings)
    r = j(c, "put", json={"vendor": "none"})
    assert r.status_code == 409 and r.json()["code"] == "remove_first"
    assert j(c, "get").json()["vendor_locked"] is True
    assert j(c, "delete", json={"confirm_text": "remove"}).json()["code"] == "confirm_required"
    r = j(c, "delete", json={"confirm_text": "הסר"})
    assert r.status_code == 200 and r.json()["cameras_disabled"] == 1 and r.json()["revision"] == 2
    (cam,) = rows(settings, "SELECT id, enabled FROM cameras")
    assert cam == {"id": "cam1", "enabled": 0}, "the camera row stays, disabled"
    (row,) = rows(settings, "SELECT * FROM recorder_connections")
    assert row["vendor"] == "none" and row["password_enc"] is None and row["secret_json_enc"] is None and row["host"] is None
    assert [a["action"] for a in audit_rows(settings, "nvr.connection.remove")] == ["nvr.connection.remove"]
    # after the removal any available vendor may be chosen again
    assert j(c, "put", json=GOOD).status_code == 200


# ---------------------------------------------------------------- AT-022-15 restart route

def test_restart_route(world, fake, settings, monkeypatch):
    app, c = world
    r = j(c, "post", "/api/v1/system/restart", json={"confirm": True})
    assert r.status_code == 409 and r.json()["code"] == "restart_manual", "outside the add-on: restart by hand"
    calls: list[tuple[str, str, str | None]] = []
    monkeypatch.setattr(addon_restart, "BASE_URL", "http://fake-supervisor.test")
    monkeypatch.setattr(addon_restart, "TOKEN", "fake-token")
    monkeypatch.setattr(addon_restart, "TRANSPORT", httpx.MockTransport(lambda req: calls.append((req.method, req.url.path, req.headers.get("authorization"))) or httpx.Response(200, json={"result": "ok"})))
    assert j(c, "post", "/api/v1/system/restart", json={"confirm": False}).json()["code"] == "confirm_required"
    assert j(c, "post", "/api/v1/system/restart", "vera", json={"confirm": True}).status_code == 403
    assert calls == []
    assert j(c, "get").json()["restart"] == "addon"
    r = j(c, "post", "/api/v1/system/restart", json={"confirm": True})
    assert r.status_code == 202 and r.json() == {"restarting": True}
    assert calls == [("POST", "/addons/self/restart", "Bearer fake-token")], "exactly one call, the add-on restart"
    r = j(c, "post", "/api/v1/system/restart", json={"confirm": True})
    assert r.status_code == 429 and r.json()["code"] == "rate_limited" and len(calls) == 1
    acts = [(a["decision"], a["reason"]) for a in audit_rows(settings, "system.restart")]
    assert acts == [("allowed", None), ("denied", "rate_limited")]


# ---------------------------------------------------------------- AT-022-02 no secret anywhere

def test_the_password_appears_nowhere(world, fake, settings, caplog):
    caplog.set_level(logging.DEBUG)
    app, c = world
    texts = [j(c, "post", API + "/test", json=GOOD).text, j(c, "put", json=GOOD).text, j(c, "get").text, j(c, "get", "/api/v1/me").text,
             j(c, "get", "/api/v1/health").text, j(c, "get", "/api/v1/setup/state").text]
    fake.nvr["auth"] = False
    texts.append(j(c, "put", json={**GOOD, "password": OTHER}).text)
    fake.nvr["auth"] = True
    blob = rows(settings, "SELECT password_enc FROM recorder_connections")[0]["password_enc"]
    audit_text = json.dumps(audit_rows(settings), ensure_ascii=False)
    restarted = create_app(settings)
    for secret in (CANARY, OTHER, blob, blob[3:20]):
        for t in texts:
            assert secret not in t
        assert secret not in audit_text
        assert secret not in caplog.text
        assert secret not in repr(restarted.state.settings)
    assert restarted.state.settings.nvr_password == CANARY  # the running process can use it, by design


# ---------------------------------------------------------------- AT-022-17 backups

SECRET_COLUMN = re.compile(r"password|secret|token|_enc$", re.I)
NOT_SECRET = {("catalog_items", "color_token")}  # a design-token name, not a credential


def test_no_backup_table_has_a_secret_like_column(settings, fake):
    app = create_app(settings)
    with Database(settings.db_path).connection(mode="read") as conn:
        tables = backup.PROJECT_TABLES + backup.ACCESS_TABLES + [t for ts in backup.OPTIONAL_TABLES.values() for t in ts]
        bad = {t: [col[1] for col in conn.execute(f"PRAGMA table_info({t})").fetchall() if SECRET_COLUMN.search(col[1]) and (t, col[1]) not in NOT_SECRET] for t in tables}
    assert {t: cols for t, cols in bad.items() if cols} == {}
    assert "recorder_connections" not in tables and "wiskey_station_credentials" not in tables and "alarm_panel_codes" not in tables
    assert connection_store.IMPORT_DONE_KEY in backup.SETTINGS_KEEP
    assert app is not None


def test_backups_carry_neither_the_connection_nor_its_key_and_restore_keeps_the_row(world, fake, settings, tmp_path):
    _, c = world
    assert j(c, "put", json=GOOD).status_code == 200
    blob = rows(settings, "SELECT password_enc FROM recorder_connections")[0]["password_enc"]
    with Database(settings.db_path).connection() as conn:
        entry = backup.create(settings, conn, include_audit=True)
    path = backup.backups_dir(settings) / entry["name"]
    with zipfile.ZipFile(path) as z:
        names = z.namelist()
        payload = b"".join(z.read(n) for n in names)
    assert not any("recorder_connections" in n or "connections.key" in n or n.startswith("files/keys") for n in names), names
    for secret in (CANARY.encode(), blob.encode(), connection_store.key_path(settings).read_bytes()):
        assert secret not in payload
    with Database(settings.db_path).connection() as conn:
        backup.restore(settings, conn, path, mode="replace")
    (row,) = rows(settings, "SELECT * FROM recorder_connections")
    assert row["password_enc"] == blob and row["revision"] == 1, "a replace restore leaves the stored connection alone"
    # onto another installation: the recorders travel, the connection does not
    other = dataclasses.replace(settings, data_dir=tmp_path / "other")
    create_app(other)
    with Database(other.db_path).connection() as conn:
        backup.restore(other, conn, path, mode="replace")
    assert rows(other, "SELECT * FROM recorder_connections") == []
    with Database(other.db_path).connection(mode="read") as conn:
        assert get_setting(conn, connection_store.IMPORT_DONE_KEY) is None


# ---------------------------------------------------------------- AT-022-18 remote channel

def test_the_routes_are_blocked_on_the_remote_channel():
    from smplwise import remote_channel

    for prefix in ("/api/v1/nvr/connection", "/api/v1/nvr/vendors", "/api/v1/system/restart"):
        assert prefix in remote_channel.BLOCKED_ON_REMOTE  # every method, every sub-path (test_remote_access walks every route)


# ---------------------------------------------------------------- AT-022-19 go2rtc streams after a credential change

def test_a_credential_change_refreshes_our_streams_and_never_touches_foreign_ones(settings, fake):
    s = from_options(settings)
    app = create_app(s)
    add_camera(s)
    with Database(s.db_path).connection() as conn:
        autosync.ensure_streams(app.state.settings, conn)
    fake.writes.clear()
    c = TestClient(app)
    assert j(c, "put", json={**GOOD, "password": OTHER}).status_code == 200
    restarted = create_app(s)
    eff = restarted.state.settings
    assert eff.nvr_password == OTHER
    assert OTHER in __import__("urllib.parse", fromlist=["unquote"]).unquote(g2.hikvision_rtsp_url(eff, 1, "sub"))
    with Database(s.db_path).connection() as conn:
        res = autosync.ensure_streams(eff, conn)
    assert res["updated"] + res["created"] == 2 and res["foreign_streams_untouched"] == 2
    assert fake.writes and all(w.split(" ", 2)[2].startswith("smplwise_") for w in fake.writes), fake.writes
    assert fake.go2rtc["foreign"] == ["intercom_door_1", "intercom_door_2"]


# ---------------------------------------------------------------- AT-022-20 operator wording

FORBIDDEN = ("Add-on", "add-on", "Home Assistant", "Configuration", "Supervisor", "Ingress", "nvr_host", "nvr_username", "nvr_password")


def test_mode_and_wizard_nvr_texts_have_no_platform_options_wording():
    from smplwise import mode

    texts = [mode.NVR_NOT_CONFIGURED_MESSAGE, mode.NVR_LESS_LABEL, mode.UNREADABLE_LABEL, wizard.NVR_LESS_ACTION, wizard.NVR_CHOICE_ACTION,
             wizard.NVR_UNREADABLE_ACTION, *[t for pair in wizard.NVR_ERRORS.values() for t in pair]]
    for t in texts:
        for word in FORBIDDEN:
            assert word not in t, (word, t)


def test_wizard_nvr_step_for_a_fresh_ha_only_installation_has_no_platform_wording(settings, fake):
    c = TestClient(create_app(dataclasses.replace(settings, nvr_host=None)))
    step = next(s for s in c.get("/api/v1/setup/state").json()["steps"] if s["id"] == "nvr")
    assert step["status"] == "todo"
    for word in FORBIDDEN:
        assert word not in json.dumps(step, ensure_ascii=False), word


def test_a_vendor_without_an_adapter_is_refused_not_served_by_another(settings):
    from smplwise.errors import ApiError

    with pytest.raises(ApiError) as exc:
        registry.constructor_for(dataclasses.replace(settings, nvr_vendor="provision_isr"))
    assert exc.value.code == "vendor_not_supported"
    assert registry.constructor_for(settings) is registry.VENDORS["hikvision"]
    assert not registry.selectable("provision_isr") and registry.selectable("none") and registry.selectable("hikvision")


def test_migration_0052_shape(settings):
    create_app(settings)
    with sqlite3.connect(settings.db_path) as conn:
        cols = [r[1] for r in conn.execute("PRAGMA table_info(recorder_connections)").fetchall()]
        assert cols == ["recorder_id", "vendor", "host", "http_port", "rtsp_port", "username", "password_enc", "secret_json_enc", "extra_json", "enabled", "state",
                        "revision", "source", "updated_at", "updated_by"]
        with pytest.raises(sqlite3.IntegrityError):
            conn.execute("INSERT INTO recorder_connections(recorder_id, vendor, source, updated_at) VALUES ('x', 'dahua', 'ui', 'now')")
        with pytest.raises(sqlite3.IntegrityError):
            conn.execute("INSERT INTO recorder_connections(recorder_id, vendor, http_port, source, updated_at) VALUES ('x', 'hikvision', 0, 'ui', 'now')")
