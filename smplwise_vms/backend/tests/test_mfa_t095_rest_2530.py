"""MFA-T095-REST-2530 (T095 / CR-011 remaining items): approval on the phone with number matching (option D) and the personal alarm code
as the step-up of one alarm action (4E / Q6 = a). Both behind settings that are OFF by default.

The phone is simulated as in tests/test_mfa_devicekey_2490.py (a generated P-256 key signing exactly the payload the server hands out),
on its own signed-in session; the requesting "desktop" is a second session of the same user. Covered:

* defaults: both switches off - nothing listed, every new route refuses, nothing changes for anyone;
* the whole push flow: request -> content-free notice -> the phone types the number -> signed -> approved -> the requester spends it
  for ONE request of exactly that action; audit rows carry no number, signature or key material;
* negatives and replays: a wrong number denies (and cools down), "not me" denies (and cools down), a spent approval / a reused challenge /
  another session / another action / another user / the requesting session itself / an expired or unused approval / a bad or foreign
  signature are all refused; once-actions and factor changes can never be approved on the phone; superseding and cancelling; the rate
  limit; step-up off;
* the alarm code: off by default; on, it proves ONE disarm (not a bypass, not a settings change), a wrong code counts towards the SAME
  lockout as the alarm screen's code, and a user whose only method is the alarm code is gated for an alarm action only while it is on;
* settings: validation, defaults, never restored from a backup."""
from __future__ import annotations

import json
import time
import types

import pytest
from fastapi.testclient import TestClient

from smplwise.services import backup, settings_store
from smplwise.services import push_approval as pa
from smplwise.services import second_factor as sf
from smplwise.services import step_up
from test_alarm import BOSS, CODE, PIN, _act, _bypass, _fresh_limits, _no_code, alarm_app  # noqa: F401 - fixtures
from test_mfa_devicekey_2490 import Phone, register
from test_remote_access import ORIGIN
from test_second_factor import arx, fresh_login  # noqa: F401 - `arx` is the fixture

API = "/arx/api/v1"
VERIFY = f"{API}/auth/step-up/verify"
PUSH = f"{API}/auth/step-up/push"
PENDING = f"{API}/auth/push-approvals"
SETTINGS = f"{API}/settings"
HOUSE = "alarm_control_panel.risco_house"


class PaClock:
    def __init__(self, monkeypatch):
        self.t = pa._now()
        monkeypatch.setattr(pa, "_now", lambda: self.t)

    def advance(self, seconds: float) -> None:
        self.t += seconds


@pytest.fixture(autouse=True)
def _clean():
    pa.reset_for_tests()
    yield
    pa.reset_for_tests()


@pytest.fixture()
def paclock(monkeypatch):
    return PaClock(monkeypatch)


def login(arx, user, code: str | None = None) -> TestClient:  # noqa: F811 - a parameter named like the fixture
    c = TestClient(arx.app, headers=ORIGIN)
    extra = {"X-Arx-Second-Factor": code} if code else {}
    r = c.post(f"{API}/auth/session", headers={"Authorization": f"Bearer {arx.token(user)}", **extra})
    assert r.status_code == 200, r.text
    return c


class Setup(types.SimpleNamespace):
    pass


@pytest.fixture()
def two(arx):  # noqa: F811 - the pytest fixture
    """The owner's phone (arx.client, a phone key registered) and the owner's desktop (another session, no proof). Push approval on."""
    assert fresh_login(arx, arx.owner).status_code == 200
    phone = Phone()
    assert register(arx, phone).status_code == 200
    arx.setting("security.push_approval", "on")
    return Setup(arx=arx, phone=phone, app=arx.client, desk=login(arx, arx.owner))


def title(c: TestClient, value: str = "x"):
    return c.patch(SETTINGS, json={"home.title": value})


def start(s: Setup, action: str = "system.configure", client: TestClient | None = None):
    return (client or s.desk).post(PUSH, json={"action": action})


def pick(s: Setup, request_id: str, number: int, *, signer: Phone | None = None, client: TestClient | None = None):
    c = client or s.app
    ch = c.post(f"{PENDING}/{request_id}/challenge", json={"key_id": s.phone.key_id, "number": number})
    assert ch.status_code == 200, ch.text
    body = ch.json()
    return c.post(f"{PENDING}/{request_id}/approve",
                  json={"challenge_id": body["challenge_id"], "key_id": s.phone.key_id, "signature": (signer or s.phone).sign(body["payload"])}), body


def approved(s: Setup, action: str = "system.configure") -> dict:
    r = start(s, action)
    assert r.status_code == 200, r.text
    started = r.json()
    a, _ = pick(s, started["request_id"], started["number"])
    assert a.status_code == 200 and a.json()["status"] == "approved", a.text
    return started


def spend(s: Setup, request_id: str, action: str = "system.configure", client: TestClient | None = None):
    return (client or s.desk).post(VERIFY, json={"method": "push", "challenge_id": request_id, "action": action})


def details(row: dict) -> dict:
    return json.loads(row["details_json"] or "{}")


# ---------------------------------------------------------------- defaults

def test_both_switches_are_off_by_default_and_restored_never():
    assert settings_store.DEFAULTS["security.push_approval"] == "off"
    assert settings_store.DEFAULTS["security.step_up_alarm_pin"] == "off"
    assert {"security.push_approval", "security.step_up_alarm_pin"} <= backup.SETTINGS_KEEP
    assert pa.DEFAULT == "off" and step_up.DEFAULT_ALARM_PIN == "off"


def test_with_the_switch_off_nothing_is_listed_and_every_route_refuses(arx):  # noqa: F811 - the pytest fixture
    assert fresh_login(arx, arx.owner).status_code == 200
    phone = Phone()
    assert register(arx, phone).status_code == 200
    desk = login(arx, arx.owner)
    r = title(desk)
    assert r.status_code == 403 and r.json()["details"]["methods"] == ["device_key"]  # no `push`
    r = desk.post(PUSH, json={"action": "system.configure"})
    assert r.status_code == 409 and r.json()["code"] == "push_approval_unavailable" and r.json()["details"]["reason"] == "off"
    assert arx.client.get(PENDING).json() == {"enabled": False, "pending": []}
    r = desk.post(VERIFY, json={"method": "push", "challenge_id": "pa_" + "x" * 30, "action": "system.configure"})
    assert r.status_code == 409 and r.json()["code"] == "step_up_method_refused"


def test_the_settings_validate(arx):  # noqa: F811 - the pytest fixture
    local = TestClient(arx.app)
    for key in ("security.push_approval", "security.step_up_alarm_pin"):
        assert local.get("/api/v1/settings").json()["settings"][key] == "off"
        assert local.patch("/api/v1/settings", json={key: "maybe"}).status_code == 422
        assert local.patch("/api/v1/settings", json={key: "on"}).status_code == 200
        assert local.get("/api/v1/settings").json()["settings"][key] == "on"


# ---------------------------------------------------------------- the push flow

def test_the_whole_flow_proves_one_request_of_exactly_that_action(two):
    s = two
    r = title(s.desk)
    assert r.status_code == 403 and r.json()["details"]["methods"] == ["device_key", "push"]
    r = start(s)
    assert r.status_code == 200, r.text
    started = r.json()
    assert started["action"] == "system.configure" and pa.NUMBER_MIN <= started["number"] <= pa.NUMBER_MAX and started["request_id"].startswith("pa_")
    # the account's own user is told on every device - content-free (no number, no action)
    with s.arx.db.connection(mode="read") as conn:
        rows = conn.execute("SELECT n.* FROM notifications n JOIN notification_recipients r ON r.notification_id = n.id "
                            "WHERE n.source = 'security.push_approval_requested' AND r.user_id = 'u-owner'").fetchall()
    assert len(rows) == 1 and json.loads(rows[0]["params_json"]) == {} and "system.configure" not in rows[0]["body"]
    # the phone sees what is asked, never the number; the requesting session does not see its own request
    listed = s.app.get(PENDING).json()
    assert listed["enabled"] is True and len(listed["pending"]) == 1
    p = listed["pending"][0]
    assert set(p) == {"request_id", "action", "expires_in"} and p["action"] == "system.configure"
    assert s.desk.get(PENDING).json()["pending"] == []
    assert s.desk.get(f"{PUSH}/{started['request_id']}").json()["status"] == "pending"
    a, ch = pick(s, started["request_id"], started["number"])
    assert a.status_code == 200 and a.json()["status"] == "approved", a.text
    assert ch["payload"].split("|")[2] == "step_up" and ch["payload"].split("|")[6] == f"auth.push_approval.n{started['number']}"
    assert s.desk.get(f"{PUSH}/{started['request_id']}").json()["status"] == "approved"
    v = spend(s, started["request_id"])
    assert v.status_code == 200 and v.json()["method"] == "push" and v.json()["minutes"] == 0, v.text
    assert title(s.desk).status_code == 200  # the one request
    assert title(s.desk, "y").status_code == 403  # and only that one
    ok = s.arx.audit("auth.step_up.ok")[-1]
    assert details(ok)["method"] == "push" and details(ok)["action_bound"] is True and details(ok)["key_id"] == s.phone.key_id
    trail = [r["action"] for r in s.arx.audit("auth.push_approval.requested") + s.arx.audit("auth.push_approval.approved")]
    assert trail == ["auth.push_approval.requested", "auth.push_approval.approved"]
    for row in s.arx.audit("auth.push_approval.requested") + s.arx.audit("auth.push_approval.approved") + [ok]:
        blob = json.dumps(details(row))
        assert "number" not in blob and "signature" not in blob and ch["challenge_id"] not in blob


def test_a_wrong_number_denies_the_request_and_cools_down(two):
    s = two
    started = start(s).json()
    wrong = started["number"] + 1 if started["number"] < pa.NUMBER_MAX else pa.NUMBER_MIN
    a, _ = pick(s, started["request_id"], wrong)
    assert a.status_code == 409 and a.json()["code"] == "push_approval_number_mismatch"
    st = s.desk.get(f"{PUSH}/{started['request_id']}").json()
    assert st["status"] == "denied" and st["reason"] == "number_mismatch"
    assert spend(s, started["request_id"]).status_code == 400
    assert s.arx.audit("auth.push_approval.denied")[-1]["reason"] == "number_mismatch"
    r = start(s)
    assert r.status_code == 429 and r.json()["code"] == "push_approval_cooldown"
    assert title(s.desk).status_code == 403


def test_not_me_denies_and_cools_down(two, paclock):
    s = two
    started = start(s).json()
    r = s.app.post(f"{PENDING}/{started['request_id']}/deny")
    assert r.status_code == 200 and r.json()["status"] == "denied" and r.json()["reason"] == "user_denied"
    assert s.arx.audit("auth.push_approval.denied")[-1]["reason"] == "user_denied"
    assert start(s).status_code == 429
    paclock.advance(pa.DENY_COOLDOWN_S + 1)
    assert start(s).status_code == 200


def test_a_number_out_of_range_is_refused_before_any_challenge(two):
    s = two
    started = start(s).json()
    for bad in (9, 100, -1):
        assert s.app.post(f"{PENDING}/{started['request_id']}/challenge", json={"key_id": s.phone.key_id, "number": bad}).status_code == 422
    assert s.desk.get(f"{PUSH}/{started['request_id']}").json()["status"] == "pending"


def test_an_approval_is_spent_once(two):
    s = two
    started = approved(s)
    assert spend(s, started["request_id"]).status_code == 200
    r = spend(s, started["request_id"])
    assert r.status_code == 400 and r.json()["code"] == "second_factor_invalid"
    assert s.arx.audit("auth.step_up.failed")[-1]["reason"] == "step_up_invalid"


def test_a_challenge_approves_once_and_never_another_request(two):
    s = two
    started = start(s).json()
    c = s.app.post(f"{PENDING}/{started['request_id']}/challenge", json={"key_id": s.phone.key_id, "number": started["number"]}).json()
    body = {"challenge_id": c["challenge_id"], "key_id": s.phone.key_id, "signature": s.phone.sign(c["payload"])}
    assert s.app.post(f"{PENDING}/{started['request_id']}/approve", json=body).status_code == 200
    # the same signed pick again: the request is no longer pending
    assert s.app.post(f"{PENDING}/{started['request_id']}/approve", json=body).status_code == 404
    # a challenge of one request presented for another
    second = start(s).json()
    r = s.app.post(f"{PENDING}/{second['request_id']}/approve", json=body)
    assert r.status_code == 400 and s.arx.audit("auth.push_approval.failed")[-1]["reason"] == "challenge_mismatch"


def test_a_signature_of_another_key_is_refused_and_counts_towards_the_lockout(two):
    s = two
    started = start(s).json()
    a, _ = pick(s, started["request_id"], started["number"], signer=Phone())
    assert a.status_code == 400 and a.json()["code"] == "second_factor_invalid"
    assert s.arx.audit("auth.push_approval.failed")[-1]["reason"] == "step_up_invalid"
    assert s.desk.get(f"{PUSH}/{started['request_id']}").json()["status"] == "pending"  # a bad signature decides nothing
    for _ in range(4):
        a, _ = pick(s, started["request_id"], started["number"], signer=Phone())
    assert a.status_code == 429 and a.json()["code"] == "second_factor_locked"
    a, _ = pick(s, started["request_id"], started["number"])  # even the right key now waits for the lockout
    assert a.status_code == 429


def test_an_approval_is_bound_to_its_session_action_and_user(two):
    s = two
    started = approved(s)
    third = login(s.arx, s.arx.owner)  # the same user, another session
    assert spend(s, started["request_id"], client=third).status_code == 400
    assert third.get(f"{PUSH}/{started['request_id']}").status_code == 404
    assert spend(s, started["request_id"], action="rbac.assign").status_code == 400
    assert spend(s, started["request_id"]).status_code == 200  # still good for its own session and action
    # another user never sees nor acts on it
    s.arx.flag("u-viewer")
    viewer = login(s.arx, s.arx.viewer)
    pending = start(s).json()
    assert viewer.get(PENDING).json()["pending"] == []
    assert viewer.post(f"{PENDING}/{pending['request_id']}/deny").status_code == 404
    assert viewer.get(f"{PUSH}/{pending['request_id']}").status_code == 404


def test_the_requesting_session_cannot_approve_itself(two):
    s = two
    started = start(s, client=s.app).json()  # the phone's own session asks...
    r = s.app.post(f"{PENDING}/{started['request_id']}/challenge", json={"key_id": s.phone.key_id, "number": started["number"]})
    assert r.status_code == 409 and r.json()["code"] == "push_approval_same_session"


def test_a_request_expires_and_an_approval_must_be_used_soon(two, paclock):
    s = two
    started = start(s).json()
    paclock.advance(pa.TTL_S + 1)
    assert s.desk.get(f"{PUSH}/{started['request_id']}").json()["status"] == "expired"
    r = s.app.post(f"{PENDING}/{started['request_id']}/challenge", json={"key_id": s.phone.key_id, "number": started["number"]})
    assert r.status_code == 404
    started = approved(s)
    paclock.advance(pa.USE_WINDOW_S + 1)
    assert spend(s, started["request_id"]).status_code == 400
    st = s.desk.get(f"{PUSH}/{started['request_id']}").json()
    assert st["status"] == "expired" and st["reason"] == "unused"


def test_once_actions_and_factor_changes_are_never_approved_on_the_phone(two, monkeypatch):
    from smplwise.routers import push_approval as router

    s = two
    from smplwise.services import ha_user_auth as hua

    monkeypatch.setattr(router, "_limit", lambda key, limits: None)  # the rate limits count refusals too (tested on their own)
    monkeypatch.setattr(hua.LIMITER, "hit", lambda key, limits: True)
    for action in sorted(step_up.ANY_ONCE_ACTIONS | step_up.FACTOR_CHANGE_ACTIONS) + ["anything.else"]:
        r = start(s, action)
        assert r.status_code == 409 and r.json()["code"] == "step_up_method_refused", (action, r.text)
        r = spend(s, "pa_" + "x" * 30, action=action)
        assert r.status_code == 409 and r.json()["code"] == "step_up_method_refused", action
    with pytest.raises(ValueError):
        step_up.mark_action(None, None, step_up.ONCE_RESET, step_up.METHOD_PUSH)


def test_a_new_request_supersedes_the_open_one_and_the_requester_may_cancel(two):
    s = two
    first = start(s).json()
    second = start(s).json()
    st = s.desk.get(f"{PUSH}/{first['request_id']}").json()
    assert st["status"] == "cancelled" and st["reason"] == "superseded"
    assert [p["request_id"] for p in s.app.get(PENDING).json()["pending"]] == [second["request_id"]]
    r = s.desk.delete(f"{PUSH}/{second['request_id']}")
    assert r.status_code == 200 and r.json()["status"] == "cancelled"
    assert s.app.get(PENDING).json()["pending"] == []
    assert s.app.post(f"{PENDING}/{second['request_id']}/deny").status_code == 404


def test_requests_are_rate_limited(two):
    s = two
    codes = [start(s).status_code for _ in range(6)]
    assert codes[:5] == [200] * 5 and codes[5] == 429


def test_the_requesters_poll_and_the_phones_look_do_not_starve_each_other(two, paclock, monkeypatch):
    """SA-01 (FIX-PUSH-APPROVAL-2560): the phone looks every 5 s (visible for a minute before the request) while the requesting screen
    polls every 2 s for the whole 90 s life of the request, and the phone approves at the end. One shared per-user bucket refused the
    requester's poll ~38 s in; separate buckets per kind of call refuse nothing."""
    from smplwise.services import ha_user_auth as hua

    s = two
    monkeypatch.setattr(hua.LIMITER, "_clock", lambda: paclock.t)
    for _ in range(12):  # the phone's watcher alone, a minute
        assert s.app.get(PENDING).status_code == 200
        paclock.advance(5)
    started = start(s).json()
    rid = started["request_id"]
    elapsed, refused, last_look = 0, [], 0
    while elapsed < pa.TTL_S - 4:
        r = s.desk.get(f"{PUSH}/{rid}")
        if r.status_code != 200:
            refused.append((elapsed, r.status_code))
        if elapsed - last_look >= 5:
            assert s.app.get(PENDING).status_code == 200
            last_look = elapsed
        paclock.advance(2)
        elapsed += 2
    assert refused == [], refused
    a, _ = pick(s, rid, started["number"])
    assert a.status_code == 200 and a.json()["status"] == "approved", a.text
    assert s.desk.get(f"{PUSH}/{rid}").json()["status"] == "approved"
    assert spend(s, rid).status_code == 200


def test_an_app_left_open_for_an_hour_keeps_working(two, paclock, monkeypatch):
    from smplwise.services import ha_user_auth as hua

    s = two
    monkeypatch.setattr(hua.LIMITER, "_clock", lambda: paclock.t)
    for _ in range(3600 // 5):  # the watcher every 5 s for a whole hour (720 calls)
        assert s.app.get(PENDING).status_code == 200
        paclock.advance(5)
    started = start(s).json()
    assert s.desk.get(f"{PUSH}/{started['request_id']}").status_code == 200
    a, _ = pick(s, started["request_id"], started["number"])
    assert a.status_code == 200, a.text


def test_nothing_is_asked_while_step_up_is_off(two):
    s = two
    s.arx.setting("security.step_up", "off")
    assert title(s.desk).status_code == 200  # the owner's switch: no confirmation at all
    r = start(s)
    assert r.status_code == 409 and r.json()["code"] == "step_up_not_applicable" and r.json()["details"]["reason"] == "off"


def test_a_user_without_a_phone_key_is_offered_no_phone_approval(arx, monkeypatch):  # noqa: F811 - the pytest fixture
    from test_second_factor import bump_step, code_now, enrol

    enrol(arx, arx.owner)
    arx.setting("security.push_approval", "on")
    bump_step(arx, "u-owner")
    clock = StepClock(monkeypatch)
    desk = login(arx, arx.owner, code_now(arx, "u-owner"))
    clock.advance(6)  # the sign-in's own proof runs out
    sf_methods = title(desk).json()["details"]["methods"]
    assert sf_methods == ["totp"]
    r = desk.post(PUSH, json={"action": "system.configure"})
    assert r.status_code == 409 and r.json()["details"]["reason"] == "no_phone_key"


# ---------------------------------------------------------------- the personal alarm code (local channel, security.step_up_local = on)

def _totp(app, s, user_id: str) -> str:
    with app.state.db.connection(mode="read") as conn:
        row = conn.execute("SELECT * FROM auth_totp WHERE user_id = ?", (user_id,)).fetchone()
    return sf.hotp(sf._secret_of(s, row), sf.step_of())


def _set(app, key: str, value: str) -> None:
    from smplwise.db import set_setting

    with app.state.db.connection() as conn:
        set_setting(conn, key, value)


class StepClock:
    def __init__(self, monkeypatch):
        self.t = step_up._now()
        monkeypatch.setattr(step_up, "_now", lambda: self.t)

    def advance(self, minutes: float) -> None:
        self.t += minutes * 60


@pytest.fixture()
def pin_alarm(alarm_app, monkeypatch):  # noqa: F811 - pytest fixtures by name
    """The developer identity on the local channel, step-up on there, a personal alarm code set, no code asked by its own policy (the
    remote-codeless situation: the alarm screen asks nothing, so the step-up dialog must). Returns (app, settings, client, calls, enrol)."""
    app, s, c, calls, _ = alarm_app
    clock = StepClock(monkeypatch)
    frozen = (int(time.time() // sf.PERIOD_S)) * sf.PERIOD_S + 15
    monkeypatch.setattr(sf, "time", types.SimpleNamespace(time=lambda: float(frozen)))
    assert c.put(f"/api/v1/alarm/panels/{HOUSE}/code", json={"code": CODE}).status_code == 200  # the stored code goes with the command
    assert c.put("/api/v1/alarm/users/dev-joni/pin", json={"pin": PIN}, headers=BOSS).status_code == 200
    _no_code(c)
    _set(app, "security.step_up", "on")
    _set(app, "security.step_up_local", "on")

    def enrol() -> None:
        assert c.post("/api/v1/auth/second-factor/enroll").status_code == 200
        assert c.post("/api/v1/auth/second-factor/confirm", json={"code": _totp(app, s, "dev-joni")}).status_code == 200
        clock.advance(6)

    return app, s, c, calls, enrol


def _pin(c, code: str = PIN, action: str = "alarm.disarm"):
    return c.post("/api/v1/auth/step-up/verify", json={"method": "alarm_pin", "code": code, "action": action})


def test_the_alarm_code_is_no_step_up_by_default(pin_alarm):
    app, s, c, calls, enrol = pin_alarm
    enrol()
    r = _act(c, HOUSE, "disarm", confirmed=True)
    assert r.status_code == 403 and r.json()["details"]["methods"] == ["totp"]
    r = _pin(c)
    assert r.status_code == 409 and r.json()["code"] == "step_up_method_refused"


def test_the_alarm_code_proves_one_disarm_only(pin_alarm):
    app, s, c, calls, enrol = pin_alarm
    enrol()
    _set(app, "security.step_up_alarm_pin", "on")
    r = _act(c, HOUSE, "disarm", confirmed=True)
    assert r.status_code == 403 and r.json()["details"]["methods"] == ["totp", "alarm_pin"]
    v = _pin(c)
    assert v.status_code == 200 and v.json()["method"] == "alarm_pin" and v.json()["minutes"] == 0, v.text
    n = len(calls)
    # a disarm proof never opens a bypass, nor a settings change
    r = _bypass(c, "binary_sensor.back_door", True, confirmed=True)
    assert r.status_code == 403 and r.json()["details"]["action"] == "alarm.bypass"
    assert c.patch("/api/v1/settings", json={"home.title": "x"}).json()["code"] == "step_up_required"
    r = _act(c, HOUSE, "disarm", confirmed=True)
    assert r.status_code == 202, r.text
    assert len(calls) == n + 1 and calls[-1]["service"] == "alarm_disarm"
    assert _act(c, HOUSE, "disarm", confirmed=True).status_code == 403  # one request only
    ok = [r for r in _audit(app, "auth.step_up.ok") if json.loads(r["details_json"]).get("method") == "alarm_pin"][-1]
    assert json.loads(ok["details_json"])["action"] == "alarm.disarm" and PIN not in ok["details_json"]
    # never for another action, also when it is on
    for action in ("system.configure", "door.open", step_up.ONCE_RESET):
        r = _pin(c, action=action)
        assert r.status_code == 409 and r.json()["code"] == "step_up_method_refused", action


def _audit(app, action: str) -> list:
    with app.state.db.connection(mode="read") as conn:
        return conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY rowid", (action,)).fetchall()


def test_a_wrong_alarm_code_shares_the_alarm_screens_lockout(pin_alarm):
    app, s, c, calls, enrol = pin_alarm
    enrol()
    _set(app, "security.step_up_alarm_pin", "on")
    for i in range(5):
        r = _pin(c, code="11112222")
        assert r.status_code == 403 and r.json()["code"] == "wrong_code", (i, r.text)
    r = _pin(c)  # the right code, but the user is locked
    assert r.status_code == 429 and r.json()["code"] == "code_locked"
    assert [json.loads(x["details_json"])["method"] for x in _audit(app, "auth.step_up.failed")][-1] == "alarm_pin"
    assert "11112222" not in json.dumps([dict(x) for x in _audit(app, "auth.step_up.failed")])
    # the alarm screen's own code prompt is locked as well (one lockout, two doors)
    _set(app, "security.step_up", "off")
    assert c.put("/api/v1/alarm/users/dev-joni/policy", json={"arm_policy": "no_code", "disarm_policy": "code_required"}, headers=BOSS).status_code == 200
    r = _act(c, HOUSE, "disarm", confirmed=True, code=PIN)
    assert r.status_code == 429 and r.json()["code"] == "code_locked"


def test_a_user_whose_only_method_is_the_alarm_code_is_gated_only_while_it_is_on(pin_alarm):
    app, s, c, calls, _enrol = pin_alarm  # no authenticator code: no step-up method
    assert _act(c, HOUSE, "disarm", confirmed=True).status_code == 202  # `no_method`: today's behaviour
    _set(app, "security.step_up_alarm_pin", "on")
    r = _act(c, HOUSE, "disarm", confirmed=True)
    assert r.status_code == 403 and r.json()["details"]["methods"] == ["alarm_pin"]
    assert _pin(c).status_code == 200
    assert _act(c, HOUSE, "disarm", confirmed=True).status_code == 202
    # everything else keeps today's behaviour for this user (no method)
    assert c.patch("/api/v1/settings", json={"home.title": "x"}).status_code == 200
    assert _act(c, HOUSE, "arm_night").status_code == 202  # arming is never gated


def test_no_alarm_code_no_method(pin_alarm):
    app, s, c, calls, enrol = pin_alarm
    enrol()
    _set(app, "security.step_up_alarm_pin", "on")
    assert c.delete("/api/v1/alarm/users/dev-joni/pin", headers=BOSS).status_code in (200, 204)
    r = _act(c, HOUSE, "disarm", confirmed=True)
    assert r.status_code == 403 and r.json()["details"]["methods"] == ["totp"]
    r = _pin(c)
    assert r.status_code == 409


# ---------------------------------------------------------------- unit: methods_for and the action-bound mark

def test_methods_for_adds_the_action_bound_methods_only_for_their_actions(two):
    s = two
    with s.arx.db.connection(mode="read") as conn:
        assert step_up.methods_for(conn, "u-owner", "system.configure") == ["device_key", "push"]
        assert step_up.methods_for(conn, "u-owner", "alarm.disarm") == ["device_key", "push"]
        assert step_up.methods_for(conn, "u-owner", step_up.ONCE_RESET) == ["device_key"]
        assert step_up.methods_for(conn, "u-owner", None) == step_up.methods_of(conn, "u-owner") == ["device_key"]
