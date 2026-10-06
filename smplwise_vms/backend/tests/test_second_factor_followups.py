"""TFA2: follow-ups of the optional second factor (owner decisions 2026-10-06 - optional, never forced, he decides later who must use it).

1. the wrong-code lockout lives in the database (review item L4) and expired rows are pruned;
2. an administrator's reset tells the user in their own inbox - no actor, no secret;
3. a per-user and per-role policy override on top of the global policy, enforced on the cookie AND the bearer sign-in;
4. the phone app's device tokens (arxd_...) end when the factor is enabled or reset, the registration survives (re-register).
No device, host or Home Assistant is contacted: the remote channel runs against the in-process fake HA core.
"""
from __future__ import annotations

import json

from fastapi.testclient import TestClient

from smplwise.services import ha_user_auth as hua
from smplwise.services import second_factor as sf
from test_remote_admins_default import bind_raw
from test_second_factor import HEADER, arx, bump_step, code_now, enrol, fresh_login  # noqa: F401 - `arx` is the fixture

OV = "/api/v1/auth/second-factor/overrides"
ME = "/arx/api/v1/me"
INSTALL = "11111111-2222-3333-4444-555555555555"


def admin(arx) -> TestClient:
    return TestClient(arx.app)  # the local developer identity, bound as system_admin by the fixture


def put(arx, kind: str, subject: str, policy: str):
    return admin(arx).put(f"{OV}/{kind}/{subject}", json={"policy": policy})


def bearer_app(ip: str, arx) -> TestClient:
    return TestClient(arx.app, headers={"CF-Connecting-IP": ip})


def b(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------- 1. the lockout survives a restart

def test_the_lockout_is_stored_and_expired_rows_are_pruned(arx):
    enrol(arx, arx.viewer)
    bump_step(arx, "u-viewer")
    codes = [fresh_login(arx, arx.viewer, "000000").status_code for _ in range(5)]
    assert codes[-1] == 429
    with arx.db.connection(mode="read") as conn:
        row = conn.execute("SELECT * FROM auth_totp_failures WHERE user_id = 'u-viewer'").fetchone()
    assert row is not None and row["locked_until"] > row["updated_at"]
    assert "000000" not in json.dumps(dict(row))  # attempts are instants, never codes
    # a "restart": nothing is held in memory, a brand new database handle and application object still see the lockout
    from smplwise.db import Database
    from smplwise.main import create_app

    create_app(arx.settings)
    with Database(arx.settings.db_path).connection(mode="read") as conn:
        assert sf.FAILURES.locked(conn, "u-viewer")
    locked = fresh_login(arx, arx.viewer, code_now(arx, "u-viewer"))
    assert locked.status_code == 429 and locked.json()["code"] == "second_factor_locked"
    # the janitor keeps a running lockout and drops the expired one
    assert sf.janitor(arx.db) == 0
    with arx.db.connection() as conn:
        conn.execute("UPDATE auth_totp_failures SET locked_until = 1, updated_at = 1 WHERE user_id = 'u-viewer'")
    assert sf.janitor(arx.db) == 1
    with arx.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM auth_totp_failures").fetchone()[0] == 0
    assert fresh_login(arx, arx.viewer, code_now(arx, "u-viewer")).status_code == 200


def test_old_wrong_codes_leave_the_window_and_a_right_code_clears_the_count(arx):
    enrol(arx, arx.viewer)
    bump_step(arx, "u-viewer")
    for _ in range(3):
        assert fresh_login(arx, arx.viewer, "000000").status_code == 401
    with arx.db.connection(mode="read") as conn:
        assert len(json.loads(conn.execute("SELECT attempts_json FROM auth_totp_failures WHERE user_id = 'u-viewer'").fetchone()[0])) == 3
    assert fresh_login(arx, arx.viewer, code_now(arx, "u-viewer")).status_code == 200
    with arx.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM auth_totp_failures").fetchone()[0] == 0


# ---------------------------------------------------------------- 2. the user is told of an administrator's reset

def _reset_notes(arx, user_id: str) -> list[dict]:
    with arx.db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute(
            "SELECT n.* FROM notifications n JOIN notification_recipients r ON r.notification_id = n.id WHERE n.source = 'security.second_factor_reset' AND r.user_id = ?",
            (user_id,)).fetchall()]


def test_an_administrator_reset_notifies_the_user_without_secrets(arx):
    body = enrol(arx, arx.viewer)
    r = admin(arx).delete("/api/v1/auth/second-factor/users/u-viewer")
    assert r.status_code == 200 and r.json()["removed"] is True
    notes = _reset_notes(arx, "u-viewer")
    assert len(notes) == 1 and notes[0]["category"] == "security" and notes[0]["subject_id"] == "u-viewer"
    dump = json.dumps(notes, ensure_ascii=False)
    for needle in (body["secret"], "dev-joni", "u-owner"):
        assert needle not in dump  # no secret, no code, not even who did it
    assert _reset_notes(arx, "u-owner") == []  # nobody else is told
    assert json.loads(arx.audit("auth.second_factor.reset")[-1]["details_json"])["user_notified"] is True
    # the user sees it in their own inbox (the real inbox route, as the user)
    fresh_login(arx, arx.viewer)
    inbox = arx.client.get("/arx/api/v1/notifications")
    assert inbox.status_code == 200 and "security.second_factor_reset" in inbox.text


def test_resetting_a_user_without_an_active_factor_tells_nobody(arx):
    assert fresh_login(arx, arx.viewer).status_code == 200
    assert arx.client.post("/arx/api/v1/auth/second-factor/enroll").status_code == 200  # pending only
    assert admin(arx).delete("/api/v1/auth/second-factor/users/u-viewer").json()["removed"] is True
    assert _reset_notes(arx, "u-viewer") == []


# ---------------------------------------------------------------- 3. per-user and per-role policy override

def test_overrides_need_system_configure_and_validate(arx):
    assert fresh_login(arx, arx.viewer).status_code == 200
    assert arx.client.get("/arx/api/v1/auth/second-factor/overrides").status_code == 403
    assert arx.client.put("/arx/api/v1/auth/second-factor/overrides/user/u-viewer", json={"policy": "required"}).status_code == 403
    assert put(arx, "user", "u-viewer", "always").status_code == 422
    assert put(arx, "user", "nobody-here", "required").status_code == 404
    assert put(arx, "role", "no-such-role", "required").status_code == 404
    assert put(arx, "group", "x", "required").status_code == 404
    assert admin(arx).get(OV).json() == {"policy": "optional", "user": {}, "role": {}}


def test_required_for_one_user_without_a_factor_gets_the_enrolment_response(arx):
    assert fresh_login(arx, arx.viewer).status_code == 200  # the directory knows the user
    assert fresh_login(arx, arx.owner).status_code == 200
    live = [s.sid for s in hua.STORE.sessions_of(user_id="u-viewer")]
    r = put(arx, "user", "u-viewer", "required")
    assert r.status_code == 200 and r.json()["user"] == {"u-viewer": "required"}
    assert [s for s in hua.STORE.sessions_of(user_id="u-viewer") if s.sid in live] == []  # a session that began before the rule ends
    r = fresh_login(arx, arx.viewer)
    assert r.status_code == 403 and r.json()["code"] == "second_factor_enrollment_required" and "set-cookie" not in r.headers
    assert fresh_login(arx, arx.owner).status_code == 200  # nobody else is touched
    # the bearer path owes it too
    r = bearer_app("198.51.100.31", arx).get(ME, headers=b(arx.token(arx.viewer)))
    assert r.status_code == 403 and r.json()["code"] == "second_factor_enrollment_required"
    # the local channel stays the break-glass path: the user can enrol there, then sign in remotely with the code
    row = json.loads(arx.audit("auth.second_factor.policy_override")[-1]["details_json"])
    assert row["before"] == "inherit" and row["after"] == "required" and row["users_affected"] == 1
    with arx.db.connection() as conn:
        sf.begin_enrolment(conn, arx.settings, "u-viewer", "dana")
    with arx.db.connection() as conn:
        sf.confirm(conn, arx.settings, "u-viewer", code_now(arx, "u-viewer"))
    bump_step(arx, "u-viewer")
    assert fresh_login(arx, arx.viewer).json()["code"] == "second_factor_required"
    assert fresh_login(arx, arx.viewer, code_now(arx, "u-viewer")).status_code == 200
    # inherit drops the override again
    assert put(arx, "user", "u-viewer", "inherit").json()["user"] == {}


def test_the_users_own_override_beats_the_role_and_the_global_policy(arx):
    arx.setting("security.second_factor_policy", "admins")
    assert fresh_login(arx, arx.owner).json()["code"] == "second_factor_enrollment_required"
    assert put(arx, "user", "u-owner", "optional").status_code == 200  # this administrator is exempt from the global rule
    assert fresh_login(arx, arx.owner).status_code == 200
    # a role override of `required` does not reach a user whose own override says optional
    assert put(arx, "role", "system_admin", "required").status_code == 200
    assert fresh_login(arx, arx.owner).status_code == 200
    assert put(arx, "user", "u-owner", "inherit").status_code == 200
    assert fresh_login(arx, arx.owner).json()["code"] == "second_factor_enrollment_required"


def test_a_required_role_applies_to_its_holders_and_any_required_role_wins(arx):
    assert fresh_login(arx, arx.viewer).status_code == 200
    r = put(arx, "role", "viewer", "required")
    assert r.status_code == 200 and r.json()["role"] == {"viewer": "required"}
    assert json.loads(arx.audit("auth.second_factor.policy_override")[-1]["details_json"])["users_affected"] >= 1
    assert fresh_login(arx, arx.viewer).json()["code"] == "second_factor_enrollment_required"
    assert bearer_app("198.51.100.32", arx).get(ME, headers=b(arx.token(arx.viewer))).status_code == 403
    # a second role of the same user says optional: `required` still wins
    bind_raw(arx, "u-viewer", "operator")
    assert put(arx, "role", "operator", "optional").status_code == 200
    assert fresh_login(arx, arx.viewer).json()["code"] == "second_factor_enrollment_required"
    # dropping the required role leaves the optional one, which shields from the global `admins` rule only
    assert put(arx, "role", "viewer", "inherit").status_code == 200
    assert fresh_login(arx, arx.viewer).status_code == 200
    # an enrolled user of a required role simply shows the code
    assert put(arx, "role", "viewer", "required").status_code == 200
    with arx.db.connection() as conn:
        sf.begin_enrolment(conn, arx.settings, "u-viewer", "dana")
    with arx.db.connection() as conn:
        sf.confirm(conn, arx.settings, "u-viewer", code_now(arx, "u-viewer"))
    bump_step(arx, "u-viewer")
    assert fresh_login(arx, arx.viewer).json()["code"] == "second_factor_required"
    assert fresh_login(arx, arx.viewer, code_now(arx, "u-viewer")).status_code == 200


def test_bearer_off_switch_still_wins_and_inherit_is_the_default(arx):
    assert fresh_login(arx, arx.owner).status_code == 200
    assert put(arx, "user", "u-owner", "required").status_code == 200
    arx.setting("security.second_factor_bearer", "off")
    r = bearer_app("198.51.100.33", arx).get(ME, headers=b(arx.token(arx.owner)))
    assert r.status_code == 200  # the owner's compatibility choice, audited as before
    created = json.loads(arx.audit("auth.remote_session.created")[-1]["details_json"])
    assert created["second_factor_skipped"] == "enroll"


# ---------------------------------------------------------------- 4. the phone's device tokens end with the factor

def _register(arx, name: str = "הנייד של דנה") -> dict:
    r = arx.client.post("/arx/api/v1/presence/devices", json={"name": name, "platform": "ios", "install_id": INSTALL, "app_version": "1.0.0", "os_version": "18.1", "model": "iPhone15,3"})
    assert r.status_code in (200, 201), r.text
    return r.json()


def _config_status(arx, token: str) -> tuple[int, str]:
    r = TestClient(arx.app, headers={"CF-Connecting-IP": "198.51.100.40"}).get("/arx/api/v1/presence/config", headers=b(token))
    return r.status_code, r.json().get("code", "")


def test_enabling_the_factor_ends_device_tokens_but_the_registration_survives(arx):
    assert fresh_login(arx, arx.viewer).status_code == 200
    dev = _register(arx)
    token = dev["device_token"]
    assert _config_status(arx, token)[0] == 200
    assert arx.client.post("/arx/api/v1/auth/second-factor/enroll").status_code == 200
    assert _config_status(arx, token)[0] == 200  # a pending secret changes nothing
    assert arx.client.post("/arx/api/v1/auth/second-factor/confirm", json={"code": code_now(arx, "u-viewer")}).status_code == 200
    assert _config_status(arx, token) == (401, "device_token_invalid")
    assert json.loads(arx.audit("auth.second_factor.enrolled")[-1]["details_json"])["device_tokens_revoked"] == 1
    with arx.db.connection(mode="read") as conn:
        row = conn.execute("SELECT * FROM mobile_devices WHERE id = ?", (dev["device_id"],)).fetchone()
    assert row["revoked_at"] is None and row["token_hash"].startswith("revoked:") and token not in json.dumps(dict(row))  # the row stays, the credential is gone
    # the app re-registers through a session (which owed the code) and the SAME device comes back with a new token
    again = _register(arx)
    assert again["device_id"] == dev["device_id"] and again["device_token"] != token and again["created"] is False
    assert _config_status(arx, again["device_token"])[0] == 200


def test_an_administrator_reset_ends_device_tokens_too(arx):
    enrol(arx, arx.viewer)
    dev = _register(arx)
    # the enrolment above predates the registration, so this token is live
    assert _config_status(arx, dev["device_token"])[0] == 200
    assert admin(arx).delete("/api/v1/auth/second-factor/users/u-viewer").status_code == 200
    assert _config_status(arx, dev["device_token"]) == (401, "device_token_invalid")
    assert json.loads(arx.audit("auth.second_factor.reset")[-1]["details_json"])["device_tokens_revoked"] == 1
    # another user's device is not touched
    assert fresh_login(arx, arx.owner).status_code == 200
    mine = _register(arx, name="הנייד של יוני")
    assert admin(arx).delete("/api/v1/auth/second-factor/users/u-viewer").status_code == 200
    assert _config_status(arx, mine["device_token"])[0] == 200
