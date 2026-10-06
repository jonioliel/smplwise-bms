"""K11 first slice: the optional TOTP second factor - RFC 6238 vectors, encrypted storage, own enrolment / removal, the
remote sign-in gate (code header, replay, lockout, rotation), the policy field, the administrator's audited reset."""
from __future__ import annotations

import base64
import json
import logging
import time

import pytest
from fastapi.testclient import TestClient

from smplwise.services import ha_user_auth as hua
from smplwise.services import second_factor as sf
from test_remote_access import ORIGIN, Arx
from test_remote_admins_default import bind_raw

HEADER = "X-Arx-Second-Factor"
RFC_SECRET = b"12345678901234567890"


# ---------------------------------------------------------------- the algorithm

@pytest.mark.parametrize("t,expected", [(59, "94287082"), (1111111109, "07081804"), (1111111111, "14050471"), (1234567890, "89005924"), (2000000000, "69279037")])
def test_rfc6238_sha1_vectors(t, expected):
    assert sf.hotp(RFC_SECRET, t // 30, digits=8) == expected


def test_six_digit_code_and_drift_window():
    now = 1_700_000_000.0
    code = sf.hotp(RFC_SECRET, sf.step_of(now))
    assert len(code) == 6 and sf.match_step(RFC_SECRET, code, now) == sf.step_of(now)
    assert sf.match_step(RFC_SECRET, code, now + 30) == sf.step_of(now)  # one step of drift either way
    assert sf.match_step(RFC_SECRET, code, now - 30) == sf.step_of(now)
    assert sf.match_step(RFC_SECRET, code, now + 95) is None
    assert sf.match_step(RFC_SECRET, "12345", now) is None and sf.match_step(RFC_SECRET, "12345a", now) is None


def test_provisioning_uri_is_a_standard_otpauth_link():
    uri = sf.provisioning_uri(RFC_SECRET, "dana")
    assert uri.startswith("otpauth://totp/SmplWise%20Arx%3Adana?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&")
    assert "issuer=SmplWise%20Arx" in uri and "digits=6" in uri and "period=30" in uri and "algorithm=SHA1" in uri


# ---------------------------------------------------------------- the app

@pytest.fixture()
def arx(settings, tmp_path, monkeypatch):
    sf.FAILURES.clear()
    import types

    frozen = (int(time.time() // sf.PERIOD_S)) * sf.PERIOD_S + 15  # the middle of a 30 s step: no boundary can fall inside a test
    monkeypatch.setattr(sf, "time", types.SimpleNamespace(time=lambda: float(frozen)))
    a = Arx(settings, tmp_path, monkeypatch)
    a.flag("u-viewer")
    a.bind("u-viewer", "viewer")
    a.flag("u-owner")
    bind_raw(a, "u-owner", "system_admin")
    bind_raw(a, "dev-joni", "system_admin")  # the local developer identity administers the installation
    yield a
    hua.reset_for_tests()
    sf.FAILURES.clear()


def secret_of(arx: Arx, user_id: str) -> bytes:
    with arx.db.connection(mode="read") as conn:
        row = conn.execute("SELECT * FROM auth_totp WHERE user_id = ?", (user_id,)).fetchone()
    return sf._secret_of(arx.settings, row)


def code_now(arx: Arx, user_id: str, offset: int = 0) -> str:
    return sf.hotp(secret_of(arx, user_id), sf.step_of() + offset)


def fresh_login(arx: Arx, user, code: str | None = None):
    arx.client.cookies.clear()
    return arx.login(user, **({HEADER: code} if code is not None else {}))


def enrol(arx: Arx, user) -> dict:
    """Sign the user in (no factor yet), enrol and confirm over the remote channel; returns the enrolment answer."""
    assert fresh_login(arx, user).status_code == 200
    r = arx.client.post("/arx/api/v1/auth/second-factor/enroll")
    assert r.status_code == 200, r.text
    body = r.json()
    r2 = arx.client.post("/arx/api/v1/auth/second-factor/confirm", json={"code": code_now(arx, user.id)})
    assert r2.status_code == 200 and r2.json()["enabled"] is True, r2.text
    return body


def bump_step(arx: Arx, user_id: str, minus: int = 100) -> None:
    """Forget the used step so the next code of the same step is accepted again (tests running inside one 30 s step)."""
    with arx.db.connection() as conn:
        conn.execute("UPDATE auth_totp SET last_step = last_step - ? WHERE user_id = ?", (minus, user_id))


def test_default_policy_is_optional_and_nothing_is_forced(arx):
    local = TestClient(arx.app)
    assert local.get("/api/v1/settings").json()["settings"]["security.second_factor_policy"] == "optional"
    assert fresh_login(arx, arx.viewer).status_code == 200  # no factor, no code needed
    assert fresh_login(arx, arx.owner).status_code == 200  # an administrator too
    st = arx.client.get("/arx/api/v1/auth/second-factor").json()
    assert st["enabled"] is False and st["policy"] == "optional"


def test_enrolment_stores_only_ciphertext_and_the_status_never_shows_the_secret(arx):
    body = enrol(arx, arx.viewer)
    assert body["otpauth_uri"].startswith("otpauth://totp/") and body["issuer"] == "SmplWise Arx"
    secret_b32 = body["secret"]
    assert base64.b32decode(secret_b32 + "=" * (-len(secret_b32) % 8)) == secret_of(arx, "u-viewer")
    with arx.db.connection(mode="read") as conn:
        row = conn.execute("SELECT * FROM auth_totp WHERE user_id = 'u-viewer'").fetchone()
        dump = json.dumps([tuple(r) for r in conn.execute("SELECT * FROM auth_totp").fetchall()])
    assert row["secret_ct"].startswith("v1:") and row["enabled"] == 1 and row["enabled_at"]
    assert secret_b32 not in dump and base64.b64encode(secret_of(arx, "u-viewer")).decode() not in dump
    st = arx.client.get("/arx/api/v1/auth/second-factor").json()
    assert st["enabled"] is True and "secret" not in json.dumps(st)
    # the ciphertext is bound to the user: copied onto another user's row it does not decrypt
    with arx.db.connection() as conn:
        conn.execute("INSERT INTO auth_totp(user_id, secret_ct, enabled, created_at) VALUES ('u-other', ?, 1, 'x')", (row["secret_ct"],))
        other = conn.execute("SELECT * FROM auth_totp WHERE user_id = 'u-other'").fetchone()
    with pytest.raises(sf.SecondFactorError) as e:
        sf._secret_of(arx.settings, other)
    assert e.value.code == "unreadable"


def test_a_wrong_first_code_does_not_enable_and_an_active_factor_cannot_be_re_enrolled(arx):
    assert fresh_login(arx, arx.viewer).status_code == 200
    assert arx.client.post("/arx/api/v1/auth/second-factor/enroll").status_code == 200
    r = arx.client.post("/arx/api/v1/auth/second-factor/confirm", json={"code": "000000"})
    assert r.status_code == 400 and r.json()["code"] == "second_factor_invalid"
    assert arx.client.get("/arx/api/v1/auth/second-factor").json()["enabled"] is False
    assert fresh_login(arx, arx.viewer).status_code == 200  # a pending secret gates nothing
    assert arx.client.post("/arx/api/v1/auth/second-factor/confirm", json={"code": code_now(arx, "u-viewer")}).status_code == 200
    again = arx.client.post("/arx/api/v1/auth/second-factor/enroll")
    assert again.status_code == 409 and again.json()["code"] == "second_factor_already_enabled"


def test_sign_in_of_an_enrolled_user_needs_the_code(arx):
    enrol(arx, arx.viewer)
    bump_step(arx, "u-viewer")
    live = hua.STORE.count()  # the session the enrolment signed in with
    r = fresh_login(arx, arx.viewer)
    assert r.status_code == 401 and r.json()["code"] == "second_factor_required"
    assert "set-cookie" not in r.headers and hua.STORE.count() == live
    r = fresh_login(arx, arx.viewer, "000000")
    assert r.status_code == 401 and r.json()["code"] == "second_factor_invalid" and hua.STORE.count() == live
    r = fresh_login(arx, arx.viewer, code_now(arx, "u-viewer"))
    assert r.status_code == 200 and "arx_session=" in r.headers["set-cookie"]
    assert arx.client.get("/arx/api/v1/me").json()["user"]["id"] == "u-viewer"


def test_a_code_cannot_be_used_twice(arx):
    enrol(arx, arx.viewer)  # the enrolment's confirm code is the used step of this 30 s window
    code = code_now(arx, "u-viewer")
    assert fresh_login(arx, arx.viewer, code).status_code == 401  # same step as the confirm code: refused (replay)
    nxt = code_now(arx, "u-viewer", +1)  # the next step is inside the drift window
    assert fresh_login(arx, arx.viewer, nxt).status_code == 200
    assert fresh_login(arx, arx.viewer, nxt).status_code == 401


def test_rotation_of_a_live_session_needs_no_new_code(arx):
    enrol(arx, arx.viewer)
    bump_step(arx, "u-viewer")
    assert fresh_login(arx, arx.viewer, code_now(arx, "u-viewer")).status_code == 200
    live = hua.STORE.count()
    again = arx.login(arx.viewer)  # the browser re-exchanges with its own cookie after a token refresh
    assert again.status_code == 200 and hua.STORE.count() == live


def test_five_wrong_codes_lock_the_user_out(arx):
    enrol(arx, arx.viewer)
    bump_step(arx, "u-viewer")
    codes = [fresh_login(arx, arx.viewer, "000000").status_code for _ in range(5)]
    assert codes[:4] == [401] * 4 and codes[4] == 429
    locked = fresh_login(arx, arx.viewer, code_now(arx, "u-viewer"))
    assert locked.status_code == 429 and locked.json()["code"] == "second_factor_locked" and locked.json()["retryable"] is True
    sf.FAILURES._locked["u-viewer"] = 0.0  # the lockout ends
    assert fresh_login(arx, arx.viewer, code_now(arx, "u-viewer")).status_code == 200


def test_the_user_disables_their_own_factor_only_with_a_current_code(arx):
    enrol(arx, arx.viewer)
    bump_step(arx, "u-viewer")
    assert arx.client.post("/arx/api/v1/auth/second-factor/disable", json={"code": "123456"}).status_code in (400, 429)
    r = arx.client.post("/arx/api/v1/auth/second-factor/disable", json={"code": code_now(arx, "u-viewer")})
    assert r.status_code == 200 and r.json()["enabled"] is False
    assert fresh_login(arx, arx.viewer).status_code == 200
    removed = arx.audit("auth.second_factor.removed")
    assert removed and json.loads(removed[-1]["details_json"])["by"] == "self"
    assert arx.client.post("/arx/api/v1/auth/second-factor/disable", json={"code": "123456"}).json()["code"] == "second_factor_not_enabled"


def test_admins_policy_refuses_an_administrator_without_a_factor_only(arx):
    arx.setting("security.second_factor_policy", "admins")
    r = fresh_login(arx, arx.owner)
    assert r.status_code == 403 and r.json()["code"] == "second_factor_enrollment_required" and "set-cookie" not in r.headers
    assert fresh_login(arx, arx.viewer).status_code == 200  # a viewer is outside the policy
    # an enrolled administrator signs in with the code
    local = TestClient(arx.app)
    with arx.db.connection() as conn:
        sf.begin_enrolment(conn, arx.settings, "u-owner", "joni")
    with arx.db.connection() as conn:
        sf.confirm(conn, arx.settings, "u-owner", code_now(arx, "u-owner"))
    bump_step(arx, "u-owner")
    assert fresh_login(arx, arx.owner).json()["code"] == "second_factor_required"
    assert fresh_login(arx, arx.owner, code_now(arx, "u-owner")).status_code == 200
    assert local.get("/api/v1/me").status_code == 200  # the local channel never asks for the factor (break-glass)


def test_the_policy_setting_validates(arx):
    local = TestClient(arx.app)
    assert local.patch("/api/v1/settings", json={"security.second_factor_policy": "admins"}).status_code == 200
    assert local.get("/api/v1/settings").json()["settings"]["security.second_factor_policy"] == "admins"
    assert local.patch("/api/v1/settings", json={"security.second_factor_policy": "everyone"}).status_code == 422


def test_admin_reset_is_audited_and_needs_system_configure(arx):
    enrol(arx, arx.viewer)
    viewer_client = arx.client
    # a viewer may not reset anyone's factor (here: their own is only removable with a code)
    r = viewer_client.delete("/arx/api/v1/auth/second-factor/users/u-viewer")
    assert r.status_code == 403
    assert viewer_client.get("/arx/api/v1/auth/second-factor/users").status_code == 403
    admin = TestClient(arx.app)  # local developer identity bound as system_admin
    listed = admin.get("/api/v1/auth/second-factor/users").json()
    assert [u["user_id"] for u in listed["users"]] == ["u-viewer"] and listed["policy"] == "optional"
    r = admin.delete("/api/v1/auth/second-factor/users/u-viewer")
    assert r.status_code == 200 and r.json() == {"user_id": "u-viewer", "removed": True}
    row = arx.audit("auth.second_factor.reset")[-1]
    details = json.loads(row["details_json"])
    assert row["actor_user_id"] == "dev-joni" and row["resource_id"] == "u-viewer" and details["removed"] is True and details["method"] == "totp"
    assert fresh_login(arx, arx.viewer).status_code == 200  # no code any more
    assert admin.get("/api/v1/auth/second-factor/users").json()["users"] == []


def test_admin_reset_works_from_the_remote_channel_too(arx):
    enrol(arx, arx.viewer)
    assert fresh_login(arx, arx.owner).status_code == 200  # the administrator, signed in remotely (no factor of their own)
    r = arx.client.delete("/arx/api/v1/auth/second-factor/users/u-viewer")
    assert r.status_code == 200 and r.json()["removed"] is True
    row = arx.audit("auth.second_factor.reset")[-1]
    assert row["actor_user_id"] == "u-owner" and json.loads(row["details_json"])["channel"] == "remote"


def test_routes_need_a_signed_in_user(arx):
    anon = TestClient(arx.app, headers=ORIGIN)
    for method, path in (("get", "auth/second-factor"), ("post", "auth/second-factor/enroll"), ("get", "auth/second-factor/users")):
        assert getattr(anon, method)(f"/arx/api/v1/{path}").status_code == 401


def test_codes_and_secrets_never_reach_logs_or_audit(arx, caplog):
    caplog.set_level(logging.DEBUG)
    body = enrol(arx, arx.viewer)
    bump_step(arx, "u-viewer")
    fresh_login(arx, arx.viewer, "654321")
    good = code_now(arx, "u-viewer")
    assert fresh_login(arx, arx.viewer, good).status_code == 200
    with arx.db.connection(mode="read") as conn:
        audit_dump = json.dumps([dict(r) for r in conn.execute("SELECT * FROM audit_log").fetchall()], ensure_ascii=False)
    for needle in (body["secret"], "654321", good, body["otpauth_uri"]):
        assert needle not in audit_dump and needle not in caplog.text
    assert arx.audit("auth.second_factor.failed") and arx.audit("auth.second_factor.enrolled")


def test_action_routes_are_rate_limited(arx):
    assert fresh_login(arx, arx.viewer).status_code == 200
    codes = [arx.client.post("/arx/api/v1/auth/second-factor/enroll").status_code for _ in range(22)]
    assert codes[:20] == [200] * 20 and 429 in codes[20:]


def test_wrong_codes_on_confirm_and_disable_are_audited_like_sign_in_failures(arx, caplog):
    """Gap from 2.2.0: the enrol-confirm and disable routes write `auth.second_factor.failed` (denied, reason, method, step); never the code."""
    caplog.set_level(logging.DEBUG)

    def failed_rows(a):
        with a.db.connection(mode="read") as conn:
            return [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action = 'auth.second_factor.failed' ORDER BY rowid").fetchall()]

    assert fresh_login(arx, arx.viewer).status_code == 200
    body = arx.client.post("/arx/api/v1/auth/second-factor/enroll").json()
    r = arx.client.post("/arx/api/v1/auth/second-factor/confirm", json={"code": "111111"})
    assert r.status_code == 400 and r.json()["code"] == "second_factor_invalid"
    rows = failed_rows(arx)
    assert len(rows) == 1 and rows[0]["decision"] == "denied" and rows[0]["reason"] == "second_factor_invalid"
    assert rows[0]["actor_user_id"] == "u-viewer" and rows[0]["resource_id"] == "u-viewer"
    d = json.loads(rows[0]["details_json"])
    assert d["method"] == "totp" and d["step"] == "enroll_confirm" and d["channel"] == "remote"
    good = code_now(arx, "u-viewer")
    assert arx.client.post("/arx/api/v1/auth/second-factor/confirm", json={"code": good}).status_code == 200
    bump_step(arx, "u-viewer")
    r = arx.client.post("/arx/api/v1/auth/second-factor/disable", json={"code": "222222"})
    assert r.status_code == 400
    rows = failed_rows(arx)
    assert len(rows) == 2 and json.loads(rows[-1]["details_json"])["step"] == "disable" and rows[-1]["decision"] == "denied"
    # a lock-out on these routes is recorded with its own reason
    for _ in range(4):
        arx.client.post("/arx/api/v1/auth/second-factor/disable", json={"code": "333333"})
    assert failed_rows(arx)[-1]["reason"] == "second_factor_locked"
    # a success is not a failure row, and no code or secret reaches the audit table or the logs
    with arx.db.connection(mode="read") as conn:
        dump = json.dumps([dict(r) for r in conn.execute("SELECT * FROM audit_log").fetchall()], ensure_ascii=False)
    for needle in (body["secret"], "111111", "222222", "333333", good):
        assert needle not in dump and needle not in caplog.text
