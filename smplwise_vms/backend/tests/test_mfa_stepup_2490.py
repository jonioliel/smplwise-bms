"""MFA-STEPUP-TRAIN-2490 slice 1: step-up before a change of settings, users and permissions (services/step_up.py).

Owner decisions 2026-11-22: Q45 (every settings / users / permissions change), Q46 (5 minutes after one approval), the note on
Q45/Q46 (a setting turns step-up off: the factor is then asked only at sign-in), Q48 (a long-lived token from outside stays allowed).
Covered: the gate refuses without a proof, a proof counts within the window and not after it, the off switch, the bearer (token)
exemption, a user with no method keeps today's behaviour, the local channel (off by default, `security.step_up_local`), reads never
gated, the 0-minute mode (one request per proof), the audit rows of success / failure / refusal, nothing half-written survives a
refusal, and the settings / restore / wire plumbing."""
from __future__ import annotations

import json
import types

import pytest
from fastapi.testclient import TestClient

from smplwise.errors import ApiError
from smplwise.rbac import INSTALLATION, Principal, require
from smplwise.remote_channel import CHANNEL_KEY, REMOTE
from smplwise.services import step_up
from test_second_factor import HEADER, arx, bump_step, code_now, enrol, fresh_login  # noqa: F401 - `arx` is the fixture

SETTINGS = "/arx/api/v1/settings"
VERIFY = "/arx/api/v1/auth/step-up/verify"
STATUS = "/arx/api/v1/auth/step-up"


class Clock:
    """The step-up clock: the monotonic clock of the marks and (MFA-SECFIX-2500 SR-5) the wall clock of stored instants move together."""

    def __init__(self, monkeypatch):
        self.t = step_up._now()
        monkeypatch.setattr(step_up, "_now", lambda: self.t)
        monkeypatch.setattr(step_up, "_WALL_SKEW_S", 0.0)

    def advance(self, minutes: float) -> None:
        self.t += minutes * 60
        step_up._WALL_SKEW_S += minutes * 60


@pytest.fixture()
def clock(monkeypatch):
    return Clock(monkeypatch)


def title(arx, value: str):
    return arx.client.patch(SETTINGS, json={"home.title": value})


def stored(arx, key: str) -> str | None:
    with arx.db.connection(mode="read") as conn:
        row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    return row[0] if row else None


def verify(arx, user_id: str, *, code: str | None = None, action: str | None = "system.configure"):
    bump_step(arx, user_id)  # a code of the step the sign-in / enrolment already used is accepted again (one 30 s step per test)
    body = {"method": "totp", "code": code if code is not None else code_now(arx, user_id)}
    if action:
        body["action"] = action
    return arx.client.post(VERIFY, json=body)


def owner_enrolled_and_stale(arx, clock) -> None:
    """The owner (system_admin) enrols over the remote channel; the enrolment's own proof then runs out."""
    enrol(arx, arx.owner)
    clock.advance(6)


def details(row: dict) -> dict:
    return json.loads(row["details_json"] or "{}")


# ---------------------------------------------------------------- the registry and the defaults

def test_the_gated_permissions_are_settings_users_and_permissions():
    assert {"system.configure", "rbac.assign", "rbac.roles.manage", "identity.local.manage", "users.ha_manage"} <= step_up.GATED_PERMISSIONS
    # physical and everyday permissions are not part of this slice (alarm / doors come with the gates slice)
    assert not {"alarm.disarm", "alarm.bypass", "access.doors.open", "devices.control", "video.live"} & step_up.GATED_PERMISSIONS


def test_defaults_step_up_on_five_minutes_remote_only_and_never_restored(arx):
    from smplwise.services import backup
    from smplwise.services.settings_store import DEFAULTS, INT_KEYS

    assert (DEFAULTS["security.step_up"], DEFAULTS["security.step_up_minutes"], DEFAULTS["security.step_up_local"]) == ("on", "5", "off")
    assert "security.step_up_minutes" in INT_KEYS
    assert {"security.step_up", "security.step_up_minutes", "security.step_up_local"} <= backup.SETTINGS_KEEP
    local = TestClient(arx.app)
    got = local.get("/api/v1/settings").json()["settings"]
    assert got["security.step_up"] == "on" and int(got["security.step_up_minutes"]) == 5 and got["security.step_up_local"] == "off"


# ---------------------------------------------------------------- required / satisfied / expired

def test_a_settings_change_without_a_fresh_proof_is_refused_and_audited(arx, clock):
    owner_enrolled_and_stale(arx, clock)
    r = title(arx, "Lobby")
    assert r.status_code == 403, r.text
    body = r.json()
    assert body["code"] == "step_up_required" and body["details"]["methods"] == ["totp"] and body["details"]["minutes"] == 5
    assert body["details"]["action"] == "system.configure" and "קוד" in body["user_message"]
    assert stored(arx, "home.title") is None  # nothing was written
    row = arx.audit("auth.step_up.required")[-1]
    assert row["decision"] == "denied" and row["actor_user_id"] == "u-owner" and row["resource_id"] == "system.configure"
    assert details(row) | {"channel": "remote"} == {"permission": "system.configure", "method": "PATCH", "route": "/settings", "channel": "remote"}
    st = arx.client.get(STATUS).json()
    assert st["applies"] is True and st["reason"] is None and st["valid_until"] is None and st["methods"] == ["totp"]


def test_reads_are_never_gated(arx, clock):
    owner_enrolled_and_stale(arx, clock)
    assert arx.client.get(SETTINGS).status_code == 200
    assert arx.client.get("/arx/api/v1/auth/second-factor/users").status_code == 200


def test_users_and_permissions_changes_are_gated_too(arx, clock):
    owner_enrolled_and_stale(arx, clock)
    r = arx.client.put("/arx/api/v1/auth/second-factor/overrides/user/u-viewer", json={"policy": "optional"})
    assert r.status_code == 403 and r.json()["code"] == "step_up_required"
    r2 = arx.client.post("/arx/api/v1/access/bindings", json={"subject_kind": "user", "subject_id": "u-viewer", "role_id": "viewer",
                                                              "scope_type": "installation", "scope_id": "*"})
    assert r2.status_code == 403 and r2.json()["code"] == "step_up_required" and r2.json()["details"]["action"] == "rbac.assign"


def test_a_verified_code_opens_a_five_minute_window(arx, clock):
    owner_enrolled_and_stale(arx, clock)
    assert title(arx, "A").status_code == 403
    v = verify(arx, "u-owner")
    assert v.status_code == 200, v.text
    assert v.json()["method"] == "totp" and v.json()["minutes"] == 5 and v.json()["valid_until"]
    ok = arx.audit("auth.step_up.ok")[-1]
    assert ok["decision"] == "allowed" and {k: details(ok)[k] for k in ("method", "action", "minutes")} == {"method": "totp", "action": "system.configure", "minutes": 5}
    assert title(arx, "B").status_code == 200 and stored(arx, "home.title") == "B"
    clock.advance(4)
    assert title(arx, "C").status_code == 200  # within the grace: no new question
    st = arx.client.get(STATUS).json()
    assert st["applies"] is True and st["valid_until"] is not None


def test_the_proof_expires_after_the_window(arx, clock):
    owner_enrolled_and_stale(arx, clock)
    assert verify(arx, "u-owner").status_code == 200
    clock.advance(5.1)
    r = title(arx, "late")
    assert r.status_code == 403 and r.json()["code"] == "step_up_required"
    assert arx.client.get(STATUS).json()["valid_until"] is None


def test_the_window_follows_the_setting(arx, clock):
    owner_enrolled_and_stale(arx, clock)
    arx.setting("security.step_up_minutes", "15")
    assert verify(arx, "u-owner").status_code == 200
    clock.advance(12)
    assert title(arx, "x").status_code == 200
    clock.advance(4)
    assert title(arx, "y").status_code == 403


def test_zero_minutes_means_one_change_per_proof(arx, clock):
    owner_enrolled_and_stale(arx, clock)
    arx.setting("security.step_up_minutes", "0")
    v = verify(arx, "u-owner")
    assert v.status_code == 200 and v.json()["minutes"] == 0
    assert title(arx, "one").status_code == 200
    assert title(arx, "two").status_code == 403  # the proof was used up by the first change


def test_the_sign_in_code_counts_as_the_first_proof(arx, clock):
    enrol(arx, arx.owner)
    clock.advance(6)
    bump_step(arx, "u-owner")
    assert fresh_login(arx, arx.owner, code_now(arx, "u-owner")).status_code == 200  # a new remote sign-in with the code
    assert title(arx, "after sign-in").status_code == 200
    clock.advance(6)
    assert title(arx, "later").status_code == 403


def fake_request(arx, sign_in: str, method: str = "POST"):
    session = types.SimpleNamespace(sign_in=lambda: sign_in)
    return types.SimpleNamespace(
        scope={"type": "http", "method": method, "state": {CHANNEL_KEY: REMOTE, "sw_remote_session": session},
               "route": types.SimpleNamespace(path="/api/v1/unit")},
        state=types.SimpleNamespace(), app=types.SimpleNamespace(state=types.SimpleNamespace(settings=arx.settings)), cookies={})


OWNER = Principal(user_id="u-owner", username="joni", display_name="יוני", source="remote", via="cookie")


def test_the_proof_belongs_to_the_session_and_the_user(arx, clock):
    enrol(arx, arx.owner)
    a, b = fake_request(arx, "i:browser-a"), fake_request(arx, "i:browser-b")
    with arx.db.connection(mode="read") as conn:
        assert step_up.mark(conn, a, OWNER, "totp") is not None
        assert step_up.valid_until(conn, a, OWNER) is not None
        assert step_up.valid_until(conn, b, OWNER) is None  # another sign-in of the same user has no proof
        someone = Principal(user_id="u-viewer", username="dana", display_name="דנה", source="remote", via="cookie")
        assert step_up.valid_until(conn, a, someone) is None  # a mark never counts for another user on the same key


# ---------------------------------------------------------------- failures

def test_a_wrong_code_is_refused_audited_and_counts_towards_the_lockout(arx, clock):
    owner_enrolled_and_stale(arx, clock)
    r = verify(arx, "u-owner", code="000000")
    assert r.status_code == 400 and r.json()["code"] == "second_factor_invalid"
    row = arx.audit("auth.step_up.failed")[-1]
    assert row["decision"] == "denied" and row["reason"] == "step_up_invalid" and "000000" not in (row["details_json"] or "")
    for _ in range(4):
        verify(arx, "u-owner", code="000000")
    locked = verify(arx, "u-owner")  # even the right code: the factor is locked
    assert locked.status_code == 429 and locked.json()["code"] == "second_factor_locked"
    assert arx.audit("auth.step_up.failed")[-1]["reason"] == "step_up_locked"
    assert title(arx, "still no").status_code == 403


def test_verify_without_a_method_or_with_step_up_off_answers_409(arx):
    assert fresh_login(arx, arx.owner).status_code == 200  # no factor enrolled
    r = arx.client.post(VERIFY, json={"code": "123456"})
    assert r.status_code == 409 and r.json()["code"] == "step_up_no_method"
    arx.setting("security.step_up", "off")
    r2 = arx.client.post(VERIFY, json={"code": "123456"})
    assert r2.status_code == 409 and r2.json()["code"] == "step_up_not_applicable" and r2.json()["details"]["reason"] == "off"


# ---------------------------------------------------------------- the off switch, exemptions, today's behaviour

def test_the_off_switch_asks_the_factor_only_at_sign_in(arx, clock):
    owner_enrolled_and_stale(arx, clock)
    # switching it off is itself a settings change: it needs the proof while step-up is on
    assert arx.client.patch(SETTINGS, json={"security.step_up": "off"}).status_code == 403
    assert verify(arx, "u-owner").status_code == 200
    assert arx.client.patch(SETTINGS, json={"security.step_up": "off"}).status_code == 200
    clock.advance(30)
    assert title(arx, "free").status_code == 200
    st = arx.client.get(STATUS).json()
    assert st["enabled"] is False and st["applies"] is False and st["reason"] == "off"
    # the sign-in itself still owes the code (the off switch touches only step-up)
    bump_step(arx, "u-owner")
    assert fresh_login(arx, arx.owner).status_code == 401


def test_a_long_lived_bearer_token_from_outside_is_exempt(arx, clock):
    # MFA-TOKENS-2490 narrowed the exemption to LONG-LIVED tokens (a short-lived bearer is gated: tests/test_mfa_tokens_2490.py)
    owner_enrolled_and_stale(arx, clock)
    bump_step(arx, "u-owner")
    bearer = TestClient(arx.app)  # a native client: Authorization on every request, no cookie
    token = arx.core.issue("u-owner", client_id=None, token_type="long_lived_access_token")["access_token"]
    headers = {"Authorization": f"Bearer {token}", HEADER: code_now(arx, "u-owner")}
    r = bearer.patch(SETTINGS, json={"home.title": "token"}, headers=headers)
    assert r.status_code == 200, r.text
    clock.advance(30)
    assert bearer.patch(SETTINGS, json={"home.title": "token2"}, headers={"Authorization": headers["Authorization"]}).status_code == 200
    st = bearer.get(STATUS, headers={"Authorization": headers["Authorization"]}).json()
    assert st["applies"] is False and st["reason"] == "bearer_token"


def test_a_user_without_a_method_keeps_todays_behaviour(arx, clock):
    assert fresh_login(arx, arx.owner).status_code == 200  # system_admin, no factor enrolled
    clock.advance(30)
    assert title(arx, "no factor").status_code == 200
    st = arx.client.get(STATUS).json()
    assert st["applies"] is False and st["reason"] == "no_method" and st["methods"] == []
    assert arx.audit("auth.step_up.required") == []


def test_the_local_channel_is_gated_only_when_the_setting_says_so(arx, clock):
    local = TestClient(arx.app)  # Ingress / developer identity dev-joni (system_admin)
    assert local.post("/api/v1/auth/second-factor/enroll").status_code == 200
    assert local.post("/api/v1/auth/second-factor/confirm", json={"code": code_now(arx, "dev-joni")}).status_code == 200
    clock.advance(6)
    assert local.patch("/api/v1/settings", json={"home.title": "local"}).status_code == 200  # default: the local channel is not gated
    assert local.get("/api/v1/auth/step-up").json()["reason"] == "local_channel"
    arx.setting("security.step_up_local", "on")
    r = local.patch("/api/v1/settings", json={"home.title": "local2"})
    assert r.status_code == 403 and r.json()["code"] == "step_up_required"
    bump_step(arx, "dev-joni")
    assert local.post("/api/v1/auth/step-up/verify", json={"code": code_now(arx, "dev-joni")}).status_code == 200
    assert local.patch("/api/v1/settings", json={"home.title": "local3"}).status_code == 200


def test_routes_with_their_own_code_check_are_left_to_it(arx, clock):
    owner_enrolled_and_stale(arx, clock)
    enrol(arx, arx.viewer)  # a target with a factor (signs the viewer in)
    bump_step(arx, "u-owner")
    assert fresh_login(arx, arx.owner, code_now(arx, "u-owner")).status_code == 200
    clock.advance(6)
    bump_step(arx, "u-owner")
    # the administrator's reset demands the administrator's own current code on every call (stricter than the window)
    r = arx.client.request("DELETE", "/arx/api/v1/auth/second-factor/users/u-viewer", json={"code": code_now(arx, "u-owner")})
    assert r.status_code == 200, r.text
    assert arx.audit("auth.step_up.required") == []


def test_a_factor_reset_drops_the_users_proofs(arx, clock):
    owner_enrolled_and_stale(arx, clock)
    assert verify(arx, "u-owner").status_code == 200
    assert step_up.forget_user("u-owner") == 1
    assert title(arx, "after reset").status_code == 403


# ---------------------------------------------------------------- nothing half-written survives a refusal

def test_a_refusal_rolls_back_what_the_request_wrote_before_the_gate(arx, clock):
    enrol(arx, arx.owner)
    clock.advance(6)
    request = fake_request(arx, "i:unit-test")
    principal = OWNER
    with pytest.raises(ApiError) as e:
        with arx.db.connection() as conn:
            step_up.attach(conn, request)
            try:
                conn.execute("INSERT INTO settings(key, value) VALUES ('unit.half_written', 'x')")
                require(conn, principal, "system.configure", INSTALLATION)
            finally:
                step_up.detach(conn)
    assert e.value.status == 403 and e.value.code == "step_up_required"
    assert stored(arx, "unit.half_written") is None
    assert details(arx.audit("auth.step_up.required")[-1])["route"] == "/unit"
    # the same call outside a request (no linked connection) is never gated
    with arx.db.connection() as conn:
        require(conn, principal, "system.configure", INSTALLATION)


def test_a_detached_connection_is_never_gated_and_a_reused_id_is_not_confused():
    a, b = object(), object()
    step_up.attach(a, "request-a")
    assert step_up.request_of(a) == "request-a" and step_up.request_of(b) is None
    step_up.detach(b)  # not linked: nothing happens
    assert step_up.request_of(a) == "request-a"
    step_up.detach(a)
    assert step_up.request_of(a) is None


def test_marks_are_bound_to_the_user():
    step_up._put("remote:i:x", step_up.Mark(user_id="u-a", at=step_up._now(), method="totp"))
    m = step_up._get("remote:i:x")
    assert m is not None and m.user_id == "u-a"
    assert step_up.forget_user("u-b") == 0 and step_up.forget_user("u-a") == 1
