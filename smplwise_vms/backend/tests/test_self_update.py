"""CR-021 slice S1: the self-update check. A fake Supervisor (frontend/tests/fixtures/update_fake_supervisor.py, a local HTTP server) stands in for the
infrastructure; no real Home Assistant, Supervisor or device is ever reached."""
from __future__ import annotations

import datetime as dt
import json
import sys
from pathlib import Path

import pytest
from conftest import as_user, bind, seed_tree
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "frontend" / "tests" / "fixtures"))
from update_fake_supervisor import TOKEN, FakeSupervisor  # noqa: E402

from smplwise import __version__, db as dbmod  # noqa: E402
from smplwise.main import create_app  # noqa: E402
from smplwise.routers.access import PERMISSION_LABELS, SYSTEM_PERMISSIONS  # noqa: E402
from smplwise.services import notify_sources, self_update  # noqa: E402

API = "/api/v1/system/update"
NEWER = "0.1.999"


@pytest.fixture()
def sup(monkeypatch):
    with FakeSupervisor() as s:
        s.installed = __version__
        s.latest = s.stale_latest = __version__
        monkeypatch.setattr(self_update, "BASE_URL", s.url)
        monkeypatch.setattr(self_update, "TOKEN", TOKEN)
        self_update.reset_limits()
        notify_sources.reset()
        yield s
        self_update.reset_limits()


@pytest.fixture()
def world(settings, sup):
    """joni = system administrator (bootstrap); the others are bound by role at installation scope."""
    app = create_app(settings)
    c = TestClient(app)
    assert c.get("/api/v1/me", headers=as_user("joni")).status_code == 200
    ids = seed_tree(c)
    for name, role, scope, sid in (("vera", "viewer", "installation", "*"), ("olga", "operator", "installation", "*"), ("sam", "site_admin", "installation", "*"),
                                   ("fia", "site_admin", "floor", ids["floor2"])):
        bind(c, settings, name, role, scope, sid)
    c.get("/api/v1/me", headers=as_user("nobody"))
    return app, c


def j(c, method, path, user="joni", **kw):
    return getattr(c, method)(f"{API}{path}", headers=as_user(user), **kw)


# ---------------------------------------------------------------- unit

def test_only_the_two_read_and_refresh_calls_can_be_sent(settings, sup):
    assert self_update.ALLOWED == {("GET", "/addons/self/info"), ("POST", "/store/reload")}
    for method, path in (("POST", "/store/addons/self/update"), ("POST", "/addons/self/update"), ("POST", "/core/restart"), ("POST", "/backups/new/partial"),
                         ("GET", "/addons"), ("DELETE", "/addons/self/info"), ("GET", "/addons/self/info/")):
        with pytest.raises(self_update.ProbeRefused):
            self_update.call(settings, method, path)
    assert sup.log == [], "a refused call never reaches a socket"


def test_version_strings_are_validated():
    assert self_update.parse_info({"version": "0.1.151", "version_latest": "0.1.152", "update_available": True}) == self_update.Info("0.1.151", "0.1.152", True)
    assert self_update.parse_info({"version": "0.1.152", "version_latest": "0.1.152", "update_available": True}).update_available is False, "equal versions: nothing to install"
    assert self_update.parse_info({"version": "0.1.151", "version_latest": "1.0; drop table x", "update_available": True}) is None
    assert self_update.parse_info({"version": "0.1.151", "version_latest": "", "update_available": True}) is None
    assert self_update.parse_info({"version": "bad version!", "version_latest": "9.9.9", "update_available": True}).installed == __version__


def test_an_unconfigured_backend_never_calls_out(settings, monkeypatch):
    monkeypatch.setattr(self_update, "BASE_URL", None)
    monkeypatch.setattr(self_update, "TOKEN", None)
    monkeypatch.delenv("SUPERVISOR_TOKEN", raising=False)
    assert self_update.configured(settings) is False
    assert self_update.call(settings, "GET", "/addons/self/info").kind == "unreachable"


def test_the_check_rate_limit_is_30s_and_20_per_hour(monkeypatch):
    t = [1000.0]
    monkeypatch.setattr(self_update, "_mono", lambda: t[0])
    self_update.reset_limits()
    assert self_update.take_check() == (True, 0)
    ok, wait = self_update.take_check()
    assert not ok and 1 <= wait <= 30
    for _ in range(19):
        t[0] += 31
        assert self_update.take_check()[0]
    t[0] += 31
    ok, wait = self_update.take_check()
    assert not ok and wait > 30, "the 21st check inside the hour waits for the hourly window"
    t[0] += 3600
    assert self_update.take_check()[0]
    self_update.reset_limits()


# ---------------------------------------------------------------- permission and the marker

def test_system_update_is_a_system_permission_of_the_system_admin_only():
    roles = json.loads((Path(dbmod.__file__).parent / "roles.json").read_text(encoding="utf-8"))["roles"]
    holders = [r["id"] for r in roles if "system.update" in r["permissions"]]
    assert holders == ["system_admin"]
    assert "system.update" in SYSTEM_PERMISSIONS and PERMISSION_LABELS["system.update"] == "עדכון המערכת"


def test_a_custom_role_cannot_carry_system_update(world):
    _, c = world
    r = c.post("/api/v1/access/roles", headers=as_user("joni"), json={"name": "מעדכן", "description": "x", "permissions": ["map.read", "system.update"], "sensitive": []})
    assert r.status_code == 422 and r.json()["code"] == "system_permission_not_allowed"


def test_permission_matrix_only_the_system_admin_may_use_the_routes(world, sup):
    _, c = world
    sup.latest = NEWER
    assert j(c, "post", "/check").status_code == 200
    calls_before = len(sup.log)
    for user in ("vera", "olga", "sam", "fia", "nobody"):
        assert j(c, "post", "/check", user).status_code == 403, user
        assert j(c, "put", "/settings", user, json={"interval_hours": 3}).status_code == 403, user
        assert j(c, "post", "/check", user).json()["code"] == "forbidden"
    assert len(sup.log) == calls_before, "a refused caller never makes the infrastructure do anything"
    assert j(c, "get", "/state").json()["interval_hours"] == 6, "the refused PUT changed nothing"


def test_state_leaks_nothing_to_anyone_without_the_permission(world, sup):
    _, c = world
    sup.latest = NEWER
    assert j(c, "post", "/check").json()["update_available"] is True
    admin = j(c, "get", "/state").json()
    assert admin["update_available"] is True and admin["latest"] == NEWER and admin["installed"] == __version__
    for user in ("vera", "olga", "sam", "fia", "nobody"):
        assert j(c, "get", "/state", user).json() == {"update_available": False}, user


def test_state_before_any_check(world):
    _, c = world
    s = j(c, "get", "/state").json()
    assert s == {"installed": __version__, "latest": None, "update_available": False, "checked_at": None, "check_result": None, "interval_hours": 6,
                 "permitted": "unknown", "notes": [], "requires_platform_restart": False, "run": None}


# ---------------------------------------------------------------- the check

def test_check_reloads_the_store_first_then_reads(world, sup):
    _, c = world
    sup.latest = NEWER
    sup.store_stale = True  # the store does not know the new version until it is reloaded
    r = j(c, "post", "/check")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["refreshed"] is True and body["check_result"] == "available" and body["latest"] == NEWER and body["update_available"] is True
    assert body["installed"] == __version__ and body["checked_at"]
    assert [m for m in sup.log] == [("POST", "/store/reload"), ("GET", "/addons/self/info")], "reload first, then the read - and nothing else"
    s = j(c, "get", "/state").json()
    assert (s["latest"], s["update_available"], s["check_result"], s["permitted"]) == (NEWER, True, "available", "yes")


def test_a_current_installation(world, sup):
    _, c = world
    r = j(c, "post", "/check").json()
    assert r["check_result"] == "current" and r["update_available"] is False and r["latest"] == __version__


def test_a_stale_state_clears_once_the_new_version_runs(world, sup):
    app, c = world
    sup.latest = NEWER
    j(c, "post", "/check")
    assert j(c, "get", "/state").json()["update_available"] is True
    with app.state.db.connection() as conn:  # the recorded latest is the running version now (an update happened)
        dbmod.set_setting(conn, "update.latest", __version__)
    assert j(c, "get", "/state").json()["update_available"] is False


def test_refresh_refused_but_read_works(world, sup):
    _, c = world
    sup.latest = NEWER
    sup.reload_status = 403  # the add-on role is still `default`
    r = j(c, "post", "/check")
    assert r.status_code == 200
    assert r.json()["refreshed"] is False and r.json()["check_result"] == "refresh_failed_read_ok" and r.json()["latest"] == NEWER
    assert j(c, "get", "/state").json()["permitted"] == "no"
    sup.reload_status = 200  # the owner changed the role: the next manual check learns it
    self_update.reset_limits()
    assert j(c, "post", "/check").json()["check_result"] == "available"
    assert j(c, "get", "/state").json()["permitted"] == "yes"


def test_read_refused_is_platform_not_permitted(world, sup):
    _, c = world
    sup.info_status = 403
    r = j(c, "post", "/check")
    assert r.status_code == 503 and r.json()["code"] == "platform_not_permitted" and r.json()["details"]["required_role"] == "manager"
    assert j(c, "get", "/state").json()["check_result"] == "not_permitted", "the refusal is recorded as the last check"


def test_infrastructure_down_and_infrastructure_error(world, sup):
    _, c = world
    sup.drop = True
    r = j(c, "post", "/check")
    assert r.status_code == 503 and r.json()["code"] == "infrastructure_unreachable"
    assert j(c, "get", "/state").json()["check_result"] == "unreachable"
    sup.drop = False
    sup.info_status = 500
    self_update.reset_limits()
    r = j(c, "post", "/check")
    assert r.status_code == 502 and r.json()["code"] == "infrastructure_error" and r.json()["details"] == {"upstream_status": 500}
    sup.info_status = 200
    sup.junk = True
    self_update.reset_limits()
    assert j(c, "post", "/check").status_code == 502


def test_a_hostile_version_is_never_taken_over(world, sup):
    _, c = world
    sup.latest_text = "1.0<script>alert(1)</script>"
    assert j(c, "post", "/check").status_code == 502
    assert j(c, "get", "/state").json()["latest"] is None


def test_a_developer_backend_without_infrastructure(settings, monkeypatch):
    monkeypatch.setattr(self_update, "BASE_URL", None)
    monkeypatch.setattr(self_update, "TOKEN", None)
    monkeypatch.delenv("SUPERVISOR_TOKEN", raising=False)
    self_update.reset_limits()
    c = TestClient(create_app(settings))
    c.get("/api/v1/me", headers=as_user("joni"))
    r = j(c, "post", "/check")
    assert r.status_code == 503 and r.json()["code"] == "infrastructure_unreachable"


def test_manual_check_is_rate_limited(world, sup):
    _, c = world
    assert j(c, "post", "/check").status_code == 200
    r = j(c, "post", "/check")
    assert r.status_code == 429 and r.json()["code"] == "rate_limited" and int(r.headers["Retry-After"]) >= 1
    assert sup.calls("POST", "/store/reload") == 1, "a rate-limited check does not reload the store"


# ---------------------------------------------------------------- settings

def test_interval_setting(world, sup):
    _, c = world
    for hours in (0, 1, 3, 6, 12, 24):
        r = j(c, "put", "/settings", json={"interval_hours": hours})
        assert r.status_code == 200 and r.json() == {"interval_hours": hours}
        assert j(c, "get", "/state").json()["interval_hours"] == hours
    for bad in ({"interval_hours": 5}, {"interval_hours": -1}, {"interval_hours": "6"}, {"interval_hours": 6, "x": 1}, {}, {"interval_hours": None}):
        assert j(c, "put", "/settings", json=bad).status_code == 422, bad
    assert j(c, "get", "/state").json()["interval_hours"] == 24


# ---------------------------------------------------------------- the scheduled tick

def test_scheduled_tick_follows_the_interval_and_only_reads(world, sup):
    app, c = world
    db = app.state.db
    settings = app.state.settings
    sup.latest = NEWER
    sup.store_stale = True
    t0 = 1_000_000.0
    assert notify_sources.update_tick(db, settings, t0) == "current", "the stale store has nothing newer; the scheduled check does not refresh it (D4)"
    st = j(c, "get", "/state").json()
    assert st["check_result"] == "current" and sup.calls("POST", "/store/reload") == 0
    assert notify_sources.update_tick(db, settings, t0 + 3600 * 5) == "skipped", "default interval: 6 hours"
    sup.store_stale = False
    assert notify_sources.update_tick(db, settings, t0 + 3600 * 6 + 1) == "available"
    st = j(c, "get", "/state").json()
    assert (st["latest"], st["update_available"], st["check_result"]) == (NEWER, True, "available") and st["checked_at"]
    assert sup.calls("POST", "/store/reload") == 0
    j(c, "put", "/settings", json={"interval_hours": 1})
    assert notify_sources.update_tick(db, settings, t0 + 3600 * 6 + 3600 + 5) == "available", "a one-hour interval checks again"
    j(c, "put", "/settings", json={"interval_hours": 0})
    assert notify_sources.update_tick(db, settings, t0 + 3600 * 100) == "off"
    calls = len(sup.log)
    assert notify_sources.update_tick(db, settings, t0 + 3600 * 200) == "off" and len(sup.log) == calls


def test_scheduled_tick_records_an_unreachable_infrastructure(world, sup):
    app, c = world
    sup.drop = True
    assert notify_sources.update_tick(app.state.db, app.state.settings, 2_000_000.0) == "unknown"
    assert j(c, "get", "/state").json()["check_result"] == "unreachable"


# ---------------------------------------------------------------- audit carries no secrets

def test_audit_rows_carry_no_token_address_or_slug(world, sup):
    app, c = world
    sup.latest = NEWER
    j(c, "post", "/check")
    j(c, "put", "/settings", json={"interval_hours": 12})
    with app.state.db.connection() as conn:
        rows = conn.execute("SELECT action, decision, details_json FROM audit_log WHERE action LIKE 'system.update.%' ORDER BY id").fetchall()
    assert j(c, "post", "/check", "vera").status_code == 403
    assert [r["action"] for r in rows] == ["system.update.check", "system.update.settings"]
    blob = " ".join(str(tuple(r)) for r in rows)
    for secret in (TOKEN, sup.url, "127.0.0.1", "supervisor", "slug", "Bearer"):
        assert secret not in blob, secret
    assert NEWER in blob
    with app.state.db.connection() as conn:
        denied = conn.execute("SELECT decision FROM audit_log WHERE action = 'system.update' AND decision = 'denied'").fetchall()
    assert len(denied) >= 1, "a refused attempt is audited"
    assert sup.auth_ok, "every request to the infrastructure carried the add-on token"


# ---------------------------------------------------------------- migration 0050

def test_migration_0050_creates_the_run_table_and_is_idempotent(settings):
    database = dbmod.Database(settings.db_path)
    applied = database.migrate()
    assert 50 in applied
    sql = (dbmod.MIGRATIONS_DIR / "0050_self_update.sql").read_text(encoding="utf-8")
    with database.connection() as conn:
        cols = {r["name"] for r in conn.execute("PRAGMA table_info(update_runs)")}
        assert cols == {"id", "created_at", "finished_at", "actor_user_id", "from_version", "to_version", "backup", "restart_platform", "state", "step", "error_code", "idempotency_key", "backup_ref"}
        conn.execute("INSERT INTO update_runs(id, created_at, from_version, to_version, state, idempotency_key) VALUES ('r1', 't', '0.1.1', '0.1.2', 'requested', 'k1')")
        with pytest.raises(Exception):
            conn.execute("INSERT INTO update_runs(id, created_at, from_version, state, idempotency_key) VALUES ('r2', 't', '0.1.1', 'requested', 'k1')")
    import sqlite3

    raw = sqlite3.connect(settings.db_path)
    try:
        raw.executescript(sql)  # a second run: CREATE ... IF NOT EXISTS, no error, the row survives
        assert raw.execute("SELECT count(*) FROM update_runs").fetchone()[0] == 1
    finally:
        raw.close()
    assert database.migrate() == []


def test_the_state_shows_an_active_run_row(world):
    app, c = world
    with app.state.db.connection() as conn:
        conn.execute("INSERT INTO update_runs(id, created_at, from_version, to_version, state) VALUES ('r1', ?, ?, '0.1.999', 'updating')", (dt.datetime.now(dt.timezone.utc).isoformat(), __version__))
    run = j(c, "get", "/state").json()["run"]
    assert run["id"] == "r1" and run["state"] == "updating" and run["to_version"] == "0.1.999"
