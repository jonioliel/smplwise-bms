"""PERF-HOME-DEVICES-2342: the load-time fixes of the home screen's and the devices screens' API calls, without behaviour change.

- GET /devices/tree, /devices/areas/{id}, /devices/items read every entity (services/devices.load_entities) and the alarm-managed set
  (alarm.managed_controls) ONCE per request - they read each two to four times within the same read transaction before;
- scope_flags (where a bulk action may start) no longer computes the per-entity exclusions it never used;
- GET /settings (routers/settings.read_settings, behind ~190 readers) reads its ~520 keys in a few statements, not one SELECT per key,
  with exactly the values the per-key read gave (an empty value and a missing row included).
The benchmark itself is tests/bench_home_devices.py (not collected)."""
from __future__ import annotations

from fastapi.testclient import TestClient
from test_devices import dev_app  # noqa: F401 - the fixture: a synced catalogue with floors, areas and an alarm panel

from smplwise.db import get_setting, get_settings_many
from smplwise.routers import settings as settings_router
from smplwise.services import alarm as alarm_svc
from smplwise.services import device_bulk
from smplwise.services import devices as dsvc


def _count(monkeypatch, module, name):
    calls = {"n": 0}
    orig = getattr(module, name)

    def wrapped(*a, **kw):
        calls["n"] += 1
        return orig(*a, **kw)

    monkeypatch.setattr(module, name, wrapped)
    return calls


def test_devices_routes_read_entities_and_alarm_set_once_per_request(dev_app, monkeypatch):  # noqa: F811
    app, _ = dev_app
    c = TestClient(app)
    before = {p: c.get(p).json() for p in ("/api/v1/devices/tree", "/api/v1/devices/areas/lobby", "/api/v1/devices/items?kind=switches&scope=building")}
    loads = _count(monkeypatch, dsvc, "load_entities")
    managed = _count(monkeypatch, alarm_svc, "managed_controls")
    for path, body in before.items():
        loads["n"] = managed["n"] = 0
        r = c.get(path)
        assert r.status_code == 200, path
        assert loads["n"] == 1, (path, loads["n"])
        assert managed["n"] <= 1, (path, managed["n"])
        assert r.json() == body, path  # the same answer as before the counters were attached


def test_scope_flags_unchanged_for_wide_and_scoped_callers(dev_app):  # noqa: F811
    app, _ = dev_app
    c = TestClient(app)
    c.get("/api/v1/me")
    from smplwise.rbac import Principal

    admin = Principal(user_id="dev-joni", username="joni", display_name="joni", source="dev")
    with app.state.db.connection(mode="read") as conn:
        ents = dsvc.load_entities(conn)
        flags = device_bulk.scope_flags(conn, admin, ents)
        wide, in_scope, permitted = device_bulk.bulk_scope(conn, admin)
        wide2, in_scope2, _p2 = device_bulk.bulk_scope(conn, admin, managed=alarm_svc.managed_controls(conn))
        assert flags == {"building": True, "all": True, "floors": set(), "areas": set()}
        assert wide is True and wide2 is True
        assert all(in_scope(e["entity_id"]) == in_scope2(e["entity_id"]) for e in ents)
        # the alarm panel is never a bulk target, whichever way the managed set reached bulk_scope
        assert not any(permitted(e["entity_id"]) for e in ents if e["entity_id"] in alarm_svc.managed_controls(conn))
        assert device_bulk.SwitchPolicy(conn).alarm_managed == device_bulk.SwitchPolicy(conn, managed=alarm_svc.managed_controls(conn)).alarm_managed


def test_get_settings_many_answers_like_get_setting(dev_app):  # noqa: F811
    app, _ = dev_app
    with app.state.db.connection() as conn:
        conn.execute("INSERT OR REPLACE INTO settings(key, value) VALUES('perf.a', 'x')")
        conn.execute("INSERT OR REPLACE INTO settings(key, value) VALUES('perf.empty', '')")
        keys = ["perf.a", "perf.empty", "perf.missing", *[f"perf.k{i}" for i in range(900)], "perf.a"]  # > 2 chunks, a repeat
        for i in range(0, 900, 3):
            conn.execute("INSERT OR REPLACE INTO settings(key, value) VALUES(?, ?)", (f"perf.k{i}", str(i)))
        got = get_settings_many(conn, keys)
        for k in keys:
            assert got.get(k, "dflt") == get_setting(conn, k, "dflt"), k
        assert "perf.missing" not in got and got["perf.empty"] == ""


def test_read_settings_identical_to_the_per_key_read(dev_app, monkeypatch):  # noqa: F811
    app, _ = dev_app
    with app.state.db.connection() as conn:
        conn.execute("INSERT OR REPLACE INTO settings(key, value) VALUES('ui.skin', 'arx')")
        conn.execute("INSERT OR REPLACE INTO settings(key, value) VALUES('playback.max_sessions', '3')")
        conn.execute("INSERT OR REPLACE INTO settings(key, value) VALUES('ui.motion', '')")  # empty reads as the default
        fast = settings_router.read_settings(conn, private=True)
        # the reference: one get_setting per key, as read_settings did before
        monkeypatch.setattr(settings_router, "get_settings_many", lambda cn, keys: {k: v for k in keys if (v := get_setting(cn, k, "\0")) != "\0"})
        slow = settings_router.read_settings(conn, private=True)
        assert fast == slow


def test_get_settings_issues_a_handful_of_statements(dev_app):  # noqa: F811
    app, _ = dev_app
    c = TestClient(app)
    c.get("/api/v1/settings")
    seen: list[str] = []
    from smplwise import db as db_mod

    orig = db_mod.Database._open

    def traced(self, *a, **kw):
        conn = orig(self, *a, **kw)
        conn.set_trace_callback(seen.append)
        return conn

    db_mod.Database._open = traced
    try:
        assert c.get("/api/v1/settings").status_code == 200
    finally:
        db_mod.Database._open = orig
    per_key = [q for q in seen if q.startswith("SELECT value FROM settings WHERE key")]
    assert len(per_key) < 40, len(per_key)  # was one per key (~520)
