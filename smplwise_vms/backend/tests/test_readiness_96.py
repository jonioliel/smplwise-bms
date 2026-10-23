"""CR-READY96 slice 1: installation readiness (score, checklist, thresholds in settings, hand-over advice, history) and demo mode on a SEPARATE database.
Negative first: nobody but a configure holder reads or edits readiness; the hand-over is never refused for a low score (advice only); demo mode is
refused to every built-in role (default off), refused remotely unless the installer's server allows it, never touches the real database file's
contents, blocks physical-action permissions while it runs, ends by itself and ends on a restart. Fakes only: no device is contacted."""
from __future__ import annotations

import datetime as dt
import json

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise import rbac
from smplwise.db import Database, now_iso
from smplwise.errors import ApiError
from smplwise.main import create_app
from smplwise.routers import readiness as readiness_router
from smplwise.services import demo_mode, readiness

API = "/api/v1"
UTC = dt.timezone.utc


@pytest.fixture(autouse=True)
def _fresh_limiter():
    readiness_router._last_check.clear()
    yield
    readiness_router._last_check.clear()


@pytest.fixture()
def c(client: TestClient) -> TestClient:
    client.get(f"{API}/me")  # the bootstrap administrator exists from here on
    return client


def _real(settings) -> Database:
    return Database(settings.db_path)


def _cameras(settings, n: int, online: int, recently_seen: int) -> None:
    db = _real(settings)
    stamp = now_iso()
    with db.connection() as conn:
        conn.execute("INSERT OR IGNORE INTO recorders(id, name, created_at) VALUES ('r1', 'NVR', ?)", (stamp,))
        for i in range(1, n + 1):
            conn.execute("INSERT INTO cameras(id, recorder_id, channel, name_source, enabled, status, last_seen_at, created_at, updated_at) VALUES (?, 'r1', ?, ?, 1, ?, ?, ?, ?)",
                         (f"c{i}", i, f"cam {i}", "online" if i <= online else "offline", stamp if i <= recently_seen else None, stamp, stamp))


def _check(report: dict, cid: str) -> dict:
    return next(x for x in report["checks"] if x["id"] == cid)


def _set(c: TestClient, **changes):
    return c.put(f"{API}/readiness/settings", json={"changes": {k.replace("__", "."): v for k, v in changes.items()}, "confirmed": True})


# ---------------------------------------------------------------- permissions

def test_only_a_configure_holder_reads_or_edits_readiness(c: TestClient, settings):
    bind(c, settings, "viewer1", "viewer", "installation", "*")
    h = as_user("viewer1")
    assert c.get(f"{API}/readiness", headers=h).status_code == 403
    assert c.post(f"{API}/readiness/check", headers=h).status_code == 403
    assert c.put(f"{API}/readiness/attest/handover", json={"done": True}, headers=h).status_code == 403
    assert c.get(f"{API}/readiness/settings", headers=h).status_code == 403
    assert c.put(f"{API}/readiness/settings", json={"changes": {"readiness.advice_score": "80"}, "confirmed": True}, headers=h).status_code == 403
    assert c.get(f"{API}/readiness").status_code == 200  # the administrator


def test_me_carries_the_readiness_chip_for_configure_holders_only(c: TestClient, settings):
    bind(c, settings, "viewer1", "viewer", "installation", "*")
    assert "readiness" not in c.get(f"{API}/me", headers=as_user("viewer1")).json()
    assert c.get(f"{API}/me").json()["readiness"] is None  # nothing recorded yet: the chip is never a computation
    c.post(f"{API}/readiness/check")
    chip = c.get(f"{API}/me").json()["readiness"]
    assert chip["score"] == c.get(f"{API}/readiness").json()["score"]


# ---------------------------------------------------------------- the score

def test_a_fresh_installation_is_low_and_blocked_on_its_critical_checks(c: TestClient):
    r = c.get(f"{API}/readiness").json()
    assert 0 <= r["score"] < 50 and r["level"] == "building"
    assert [x["id"] for x in r["checks"]][:3] == ["cameras_connected", "cameras_verified", "places"]
    assert _check(r, "cameras_connected")["status"] == "blocked" and _check(r, "backup")["status"] == "blocked"
    assert "cameras_connected" in r["handover"]["blockers"] and not r["handover"]["advice_met"]
    assert r["handover"]["may_hand_over"] is True  # advice only
    assert r["next_steps"] and all(s["href"].startswith("#/") for s in r["next_steps"])
    gains = [s["gain"] for s in r["next_steps"]]
    assert gains == sorted(gains, reverse=True)  # ordered by what they would add


def test_cameras_raise_the_score_and_a_partial_fleet_is_a_fraction(c: TestClient, settings):
    before = c.get(f"{API}/readiness").json()
    _cameras(settings, n=4, online=3, recently_seen=2)
    after = c.get(f"{API}/readiness").json()
    cc, cv = _check(after, "cameras_connected"), _check(after, "cameras_verified")
    assert cc["fraction"] == 0.75 and cc["status"] == "blocked"  # critical and below 1.0
    assert cv["fraction"] == 0.5 and cv["status"] == "attention"
    assert after["score"] > before["score"]


def test_the_people_check_needs_an_administrator_and_a_user_with_a_role(c: TestClient, settings):
    assert _check(c.get(f"{API}/readiness").json(), "people")["fraction"] == 0.5  # only the bootstrap administrator
    bind(c, settings, "viewer1", "viewer", "installation", "*")
    assert _check(c.get(f"{API}/readiness").json(), "people")["fraction"] == 1.0


def test_not_applicable_checks_leave_the_score_denominator(c: TestClient):
    r = c.get(f"{API}/readiness").json()
    modules = _check(r, "modules")
    assert modules["status"] == "not_applicable" and modules["applicable"] is False and modules["gain"] == 0


# ---------------------------------------------------------------- thresholds and weights are settings

def test_every_threshold_and_weight_is_editable_validated_and_audited(c: TestClient, settings):
    s = c.get(f"{API}/readiness/settings").json()["settings"]
    assert s["readiness.advice_score"] == "90" and s["readiness.weight.backup"] == "12"
    assert c.put(f"{API}/readiness/settings", json={"changes": {"readiness.advice_score": "80"}}).status_code == 409  # not confirmed
    assert _set(c, readiness__advice_score="abc").status_code == 422
    assert _set(c, readiness__nope="1").status_code == 422
    assert _set(c, readiness__band_almost_min="95").status_code == 422  # must stay below the advice score
    ok = _set(c, readiness__advice_score="40", readiness__band_almost_min="20", readiness__cameras_seen_hours="6", readiness__weight__backup="0")
    assert ok.status_code == 200 and sorted(ok.json()["changed"]) == ["readiness.advice_score", "readiness.band_almost_min", "readiness.cameras_seen_hours", "readiness.weight.backup"]
    r = c.get(f"{API}/readiness").json()
    assert r["bands"] == {"almost_min": 20, "advice": 40}
    assert _check(r, "backup")["weight"] == 0 and _check(r, "backup")["applicable"] is False  # weight 0 = out of the denominator
    with _real(settings).connection(mode="read") as conn:
        rows = conn.execute("SELECT resource_id FROM audit_log WHERE action = 'settings.changed' AND resource_id LIKE 'readiness.%'").fetchall()
    assert {x["resource_id"] for x in rows} >= {"readiness.advice_score", "readiness.weight.backup"}


def test_the_level_follows_the_edited_bands(c: TestClient):
    score = c.get(f"{API}/readiness").json()["score"]
    _set(c, readiness__advice_score=str(max(score, 2)), readiness__band_almost_min="1")
    assert c.get(f"{API}/readiness").json()["level"] == "ready"


def test_all_weights_zero_is_refused(c: TestClient):
    changes = {f"readiness.weight.{cid}": "0" for cid in readiness.CHECKS}
    assert c.put(f"{API}/readiness/settings", json={"changes": changes, "confirmed": True}).status_code == 422


# ---------------------------------------------------------------- hand-over: advice only

def test_the_handover_is_recorded_below_the_advice_and_says_so(c: TestClient, settings):
    r0 = c.get(f"{API}/readiness").json()
    assert not r0["handover"]["advice_met"] and _check(r0, "handover")["status"] == "pending"
    r = c.put(f"{API}/readiness/attest/handover", json={"done": True, "customer_name": "לקוח לדוגמה", "note": "מסירה מוקדמת"})
    assert r.status_code == 200, r.text  # never refused for a low score
    body = r.json()
    assert _check(body, "handover")["status"] == "ok" and body["handover"]["done"] is True
    assert any("מתחת" in f["label"] for f in _check(body, "handover")["facts"])
    with _real(settings).connection(mode="read") as conn:
        row = conn.execute("SELECT details_json FROM audit_log WHERE action = 'readiness.handover'").fetchone()
        stored = json.loads(conn.execute("SELECT payload_json FROM readiness_attestations").fetchone()[0])
    assert json.loads(row["details_json"])["below_advice"] is True and stored["below_advice"] is True and stored["customer_name"] == "לקוח לדוגמה"
    again = c.put(f"{API}/readiness/attest/handover", json={"done": False}).json()  # withdrawn
    assert _check(again, "handover")["status"] == "pending"


def test_only_the_handover_check_can_be_attested(c: TestClient):
    assert c.put(f"{API}/readiness/attest/backup", json={"done": True}).status_code == 404


# ---------------------------------------------------------------- history

def test_a_check_records_history_only_when_something_moved_and_is_rate_limited(c: TestClient, settings):
    first = c.post(f"{API}/readiness/check")
    assert first.status_code == 200 and len(first.json()["history"]) == 1
    limited = c.post(f"{API}/readiness/check")
    assert limited.status_code == 429 and limited.json()["details"]["retry_after_s"] >= 1
    readiness_router._last_check.clear()
    assert len(c.post(f"{API}/readiness/check").json()["history"]) == 1  # nothing moved: no second row
    _cameras(settings, n=2, online=2, recently_seen=2)
    readiness_router._last_check.clear()
    h = c.post(f"{API}/readiness/check").json()["history"]
    assert len(h) == 2 and h[0]["score"] > h[1]["score"]


# ================================================================ demo mode

GRANTED = ["demo.run", "system.configure"]


@pytest.fixture()
def runner(c: TestClient, settings, monkeypatch) -> TestClient:
    """The administrator also holds a custom role that names demo.run (the built-in roles never do)."""
    monkeypatch.setitem(rbac.ROLES, "demo_runner", GRANTED)
    bind(c, settings, "joni", "demo_runner", "installation", "*")
    return c


def test_no_built_in_role_holds_the_demo_permissions():
    for perms in rbac.ROLES.values():
        assert "demo.run" not in perms and "demo.run_anywhere" not in perms


def test_demo_is_refused_to_a_system_administrator_without_the_permission(c: TestClient):
    assert c.post(f"{API}/demo/start", json={}).status_code == 403
    assert c.post(f"{API}/demo/stop").status_code == 403
    assert c.post(f"{API}/demo/extend", json={"hours": 1}).status_code == 403
    assert c.get(f"{API}/demo").json() == {"active": False, "can_run": False, "datasets": ["residential", "office", "retail"], "scenarios": ["normal", "cameras_offline", "new_installation"], "max_hours": 24}


def test_start_validation(runner: TestClient):
    assert runner.post(f"{API}/demo/start", json={"dataset": "castle"}).status_code == 422
    assert runner.post(f"{API}/demo/start", json={"hours": 25}).status_code == 422
    assert runner.post(f"{API}/demo/start", json={"hours": 0}).status_code == 422
    assert runner.get(f"{API}/demo").json()["active"] is False


def _real_snapshot(settings) -> list[tuple]:
    with _real(settings).connection(mode="read") as conn:
        return [tuple(r) for r in conn.execute("SELECT key, value FROM settings ORDER BY key").fetchall()] + \
               [tuple(r) for r in conn.execute("SELECT id FROM cameras ORDER BY id").fetchall()] + \
               [tuple(r) for r in conn.execute("SELECT check_id FROM readiness_attestations").fetchall()]


def test_a_demo_runs_on_a_separate_database_and_leaves_the_real_one_untouched(runner: TestClient, settings):
    _cameras(settings, n=1, online=1, recently_seen=1)
    before = _real_snapshot(settings)
    s = runner.post(f"{API}/demo/start", json={"dataset": "office", "hours": 2})
    assert s.status_code == 200, s.text
    assert s.json()["active"] is True and s.json()["dataset"] == "office"
    assert (settings.data_dir / "demo" / "demo.sqlite").exists()
    # the banner reaches every signed-in user, including one without any role
    assert runner.get(f"{API}/me", headers=as_user("nobody")).json()["demo"]["active"] is True
    # the synthetic installation is what the product shows now; the administrator keeps their permissions (people were copied)
    r = runner.get(f"{API}/readiness")
    assert r.status_code == 200
    assert _check(r.json(), "cameras_connected")["summary"].startswith("12 מתוך 12")
    # writes made during the demo land in the demo file
    assert runner.put(f"{API}/readiness/attest/handover", json={"done": True}).status_code == 200
    assert _check(runner.get(f"{API}/readiness").json(), "handover")["status"] == "ok"
    assert runner.put(f"{API}/readiness/settings", json={"changes": {"readiness.advice_score": "55"}, "confirmed": True}).status_code == 200
    assert _real_snapshot(settings) == before  # the real file's rows are exactly as before
    assert runner.post(f"{API}/demo/start", json={}).status_code == 409  # one at a time
    st = runner.post(f"{API}/demo/stop")
    assert st.status_code == 200 and st.json() == {"active": False}
    assert not (settings.data_dir / "demo").exists()
    assert runner.get(f"{API}/me").json()["demo"] == {"active": False}
    back = runner.get(f"{API}/readiness").json()
    assert _check(back, "handover")["status"] == "pending" and back["bands"]["advice"] == 90  # nothing from the demo survived
    assert _check(back, "cameras_connected")["summary"].startswith("1 מתוך 1")
    assert _real_snapshot(settings) == before
    with _real(settings).connection(mode="read") as conn:  # start and stop are in the REAL audit log
        actions = [r["action"] for r in conn.execute("SELECT action FROM audit_log WHERE action LIKE 'demo.%' ORDER BY id").fetchall()]
    assert actions == ["demo.start", "demo.stop"]


def test_scenarios_shape_the_dataset(runner: TestClient):
    runner.post(f"{API}/demo/start", json={"scenario": "cameras_offline"})
    cc = _check(runner.get(f"{API}/readiness").json(), "cameras_connected")
    assert cc["fraction"] == pytest.approx(4 / 6)
    runner.post(f"{API}/demo/stop")
    runner.post(f"{API}/demo/start", json={"scenario": "new_installation"})
    assert _check(runner.get(f"{API}/readiness").json(), "cameras_connected")["fraction"] == 0.0
    runner.post(f"{API}/demo/stop")


def test_physical_and_update_permissions_are_refused_while_a_demo_runs(runner: TestClient, c: TestClient):
    db = runner.app.state.db
    principal = rbac.Principal(user_id="dev-joni", username="joni", display_name="joni", source="dev")
    with db.connection(mode="read") as conn:
        assert rbac.authorize(conn, principal, "devices.control", rbac.INSTALLATION).allowed
        assert rbac.authorize(conn, principal, "system.update", rbac.INSTALLATION).allowed
    runner.post(f"{API}/demo/start", json={})
    with db.connection(mode="read") as conn:
        for p in ("devices.control", "access.doors.open", "ha.entity.control", "nvr.config.write", "nvr.system.reboot", "system.update", "backup.manage", "alarm.disarm"):
            d = rbac.authorize(conn, principal, p, rbac.INSTALLATION)
            assert not d.allowed and d.reason == "demo_mode", p
        assert rbac.authorize(conn, principal, "system.configure", rbac.INSTALLATION).allowed  # reading and configuring the demo itself is fine
    assert runner.post(f"{API}/backups").status_code == 403
    runner.post(f"{API}/demo/stop")
    with db.connection(mode="read") as conn:
        assert rbac.authorize(conn, principal, "devices.control", rbac.INSTALLATION).allowed


def test_the_remote_channel_rule(runner: TestClient, settings):
    """Remote start: refused unless the installer's server allows it (demo.allow_remote) or the caller holds demo.run_anywhere (the owner)."""
    db = runner.app.state.db
    principal = rbac.Principal(user_id="dev-joni", username="joni", display_name="joni", source="dev")
    with db.connection() as conn:
        with pytest.raises(ApiError) as e:
            demo_mode.start(db, settings, conn, principal, "residential", "normal", 1, remote=True, holds_anywhere=False, rid=None)
        assert e.value.status == 403 and e.value.code == "demo_remote_refused"
        assert not db.demo
    assert runner.put(f"{API}/demo/settings", json={"allow_remote": "on"}).status_code == 409  # not confirmed
    assert runner.put(f"{API}/demo/settings", json={"allow_remote": "on", "confirmed": True}).json() == {"allow_remote": True}
    assert runner.get(f"{API}/demo").json()["allow_remote"] is True
    with db.connection() as conn:
        demo_mode.start(db, settings, conn, principal, "residential", "normal", 1, remote=True, holds_anywhere=False, rid=None)
    assert db.demo
    assert runner.put(f"{API}/demo/settings", json={"allow_remote": "off", "confirmed": True}).status_code == 409  # not while a demo runs
    runner.post(f"{API}/demo/stop")
    runner.put(f"{API}/demo/settings", json={"allow_remote": "off", "confirmed": True})
    with db.connection() as conn:
        demo_mode.start(db, settings, conn, principal, "residential", "normal", 1, remote=True, holds_anywhere=True, rid=None)  # the owner: from anywhere
    assert db.demo
    runner.post(f"{API}/demo/stop")


def test_extend_is_capped_and_the_janitor_ends_an_expired_demo(runner: TestClient, settings, monkeypatch):
    from smplwise.main import janitor_tick

    runner.post(f"{API}/demo/start", json={"hours": 1})
    started = dt.datetime.fromisoformat(runner.get(f"{API}/demo").json()["started_at"].replace("Z", "+00:00"))
    e = runner.post(f"{API}/demo/extend", json={"hours": 24}).json()
    assert dt.datetime.fromisoformat(e["expires_at"].replace("Z", "+00:00")) == started + dt.timedelta(hours=24)  # never beyond 24 h from the start
    db = runner.app.state.db
    assert demo_mode.tick(db, settings) is True  # still running
    runner.post(f"{API}/demo/extend", json={"hours": 1})
    monkeypatch.setattr(demo_mode, "now_utc", lambda: started + dt.timedelta(hours=25))
    janitor_tick(db, settings)  # the housekeeping pass ends it
    assert not db.demo and not (settings.data_dir / "demo").exists()
    assert runner.get(f"{API}/me").json()["demo"] == {"active": False}
    with _real(settings).connection(mode="read") as conn:
        assert [r["action"] for r in conn.execute("SELECT action FROM audit_log WHERE action LIKE 'demo.%' ORDER BY id").fetchall()] == ["demo.start", "demo.expire"]


def test_a_restart_exits_demo_mode(runner: TestClient, settings):
    runner.post(f"{API}/demo/start", json={})
    assert (settings.data_dir / "demo").exists()
    fresh = TestClient(create_app(settings))  # a new process: the handle starts on the real file and the demo folder is gone
    assert not fresh.app.state.db.demo and not (settings.data_dir / "demo").exists()
    assert fresh.get(f"{API}/me").json()["demo"] == {"active": False}
    runner.post(f"{API}/demo/stop")
