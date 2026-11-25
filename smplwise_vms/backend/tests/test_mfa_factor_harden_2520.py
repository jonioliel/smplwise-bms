"""MFA-FACTOR-HARDEN-2520: findings N-1, N-5 and N-6 of the second-factor review (docs/security/MFA-REVIEW-2520.md), built to the
recommendations the owner approved:

* N-1 - with step-up off (the default), EVERY factor added from outside - a phone key, a passkey, the authenticator code next to
  another factor, a new batch of recovery codes - needs a sign-in of this session within 5 minutes (403 `reauth_required`), exactly
  the rule a FIRST factor has (MFA-SECFIX-2500 SR-3). The local channel stays the break-glass path; with step-up on the proof applies
  as before (a stale session with a proof still adds);
* N-5 - an administrator's reset of another user's factors from outside (the reset, and the removal of an Arx-only identity's passkey)
  needs a sign-in of the administrator's session within 5 minutes; the preflight says so (`reason: reauth`); locally nothing changes;
* N-6 - one content-free notice (`security.second_factor_changed`) to the account's own user when a factor is removed, a new batch of
  recovery codes is made, or a sign-in is answered with a recovery code. No code, label or key in it.

Fakes only (the fake HA core of tests/test_remote_access.py); no lab, no Home Assistant, no network."""
# ruff: noqa: F811 - the fixtures are imported by name and used as test parameters
from __future__ import annotations

import json
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from smplwise.services import notify_policy, notify_sources
from smplwise.services import recovery_codes as rc
from test_local_passkeys import Px, _remote_admin, _with_passkey, px  # noqa: F401 - `px` is a fixture
from test_mfa_secreview_2500 import _age_remote_sessions
from test_mfa_stepup_2490 import Clock, clock  # noqa: F401 - `clock` is a fixture
from test_second_factor import HEADER, arx, bump_step, code_now, enrol, fresh_login  # noqa: F401 - `arx` is the fixture

API = "/arx/api/v1"
ENROLL = f"{API}/auth/second-factor/enroll"
DISABLE = f"{API}/auth/second-factor/disable"
VERIFY = f"{API}/auth/step-up/verify"
CODES = f"{API}/auth/recovery-codes"
RESET_VIEWER = f"{API}/auth/second-factor/users/u-viewer"
CHECK_VIEWER = RESET_VIEWER + "/reset-check"
SOURCE = "security.second_factor_changed"
STALE_S = 6 * 60  # just past the 5-minute rule


@pytest.fixture()
def cheap_hashes():
    from smplwise.services import local_passwords as lp

    lp._profile_override = lp.Profile(7, 10, 8, 1)  # cheap hashing for recovery codes, as slice 7's own tests
    try:
        yield
    finally:
        lp._profile_override = None


def _off(arx) -> None:
    arx.setting("security.step_up", "off")  # the installation default (owner Q2 = b); test_second_factor's fixture switches it on


def _sign_in_with_code(arx, user) -> None:
    bump_step(arx, user.id)
    assert fresh_login(arx, user, code_now(arx, user.id)).status_code == 200


def _notices(db, user_id: str) -> list[dict]:
    with db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT n.title, n.body, n.params_json, n.link FROM notifications n JOIN notification_recipients r "
                                              "ON r.notification_id = n.id WHERE n.source = ? AND r.user_id = ? ORDER BY n.first_at", (SOURCE, user_id)).fetchall()]


def _recovery_rows(arx, user_id: str) -> int:
    with arx.db.connection(mode="read") as conn:
        return conn.execute("SELECT COUNT(*) FROM auth_recovery_codes WHERE user_id = ?", (user_id,)).fetchone()[0]


# ---------------------------------------------------------------- N-1: every factor ADD from outside needs a fresh sign-in

def test_n1_a_second_phone_key_from_a_stale_session_needs_a_fresh_sign_in(arx):
    import test_mfa_devicekey_2490 as tdk

    _off(arx)
    enrol(arx, arx.viewer)  # the authenticator code: the account already has a factor
    _age_remote_sessions(STALE_S)  # a cookie stolen long after its sign-in
    r = tdk.register(arx, tdk.Phone())
    assert r.status_code == 403 and r.json()["code"] == "reauth_required", r.text
    assert r.json()["details"] == {"action": "auth.device_key.register", "within_s": 300}
    assert arx.audit("auth.device_key.refused")[-1]["reason"] == "reauth_required"
    with arx.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM auth_device_keys WHERE user_id = 'u-viewer'").fetchone()[0] == 0
    _sign_in_with_code(arx, arx.viewer)  # signing in again (with the code) is the way
    assert tdk.register(arx, tdk.Phone()).status_code == 200


def test_n1_a_second_passkey_from_a_stale_session_needs_a_fresh_sign_in(arx):
    import test_mfa_passkeys_2490 as tp

    _off(arx)
    tp.configure(arx)
    enrol(arx, arx.viewer)
    _age_remote_sessions(STALE_S)
    r = arx.client.post(tp.REG_OPTS)
    assert r.status_code == 403 and r.json()["code"] == "reauth_required", r.text
    _sign_in_with_code(arx, arx.viewer)
    tp.add_passkey(arx, arx.viewer, login=False)  # within 5 minutes of the sign-in: allowed


def test_n1_the_authenticator_next_to_a_phone_key_from_a_stale_session_needs_a_fresh_sign_in(arx):
    import test_mfa_devicekey_2490 as tdk

    _off(arx)
    assert fresh_login(arx, arx.viewer).status_code == 200
    assert tdk.register(arx, tdk.Phone()).status_code == 200  # the first factor, moments after the sign-in
    _age_remote_sessions(STALE_S)
    r = arx.client.post(ENROLL)
    assert r.status_code == 403 and r.json()["code"] == "reauth_required", r.text
    assert arx.audit("auth.second_factor.failed")[-1]["reason"] == "reauth_required"


def test_n1_a_new_batch_of_recovery_codes_from_a_stale_session_needs_a_fresh_sign_in(arx, cheap_hashes):
    import test_mfa_recovery_codes_2490 as tr

    _off(arx)
    first = tr.enrol_with_codes(arx, arx.viewer)
    _age_remote_sessions(STALE_S)
    r = arx.client.post(CODES)
    assert r.status_code == 403 and r.json()["code"] == "reauth_required", r.text
    assert "codes" not in r.json()
    row = [a for a in arx.audit("auth.recovery_codes.generated") if a["decision"] == "denied"][-1]
    assert row["reason"] == "reauth_required"
    assert _recovery_rows(arx, "u-viewer") == len(first)  # the user's own batch still stands
    assert _notices(arx.db, "u-viewer") == []  # nothing was made, nothing to tell
    # the current authenticator code is a proof of its own (as before): it still mints a batch from that session
    bump_step(arx, "u-viewer")
    r = arx.client.post(CODES, json={"code": code_now(arx, "u-viewer")})
    assert r.status_code == 200 and len(r.json()["codes"]) == len(first), r.text
    _sign_in_with_code(arx, arx.viewer)
    assert arx.client.post(CODES).status_code == 200  # a fresh sign-in: no code needed (step-up off)


def test_n1_a_fresh_session_adds_without_anything_more(arx, cheap_hashes):
    import test_mfa_devicekey_2490 as tdk

    _off(arx)
    enrol(arx, arx.viewer)
    assert tdk.register(arx, tdk.Phone()).status_code == 200  # the same session, within 5 minutes
    assert arx.client.post(CODES).status_code == 200


def test_n1_the_local_channel_is_not_limited(arx, cheap_hashes):
    _off(arx)
    local = TestClient(arx.app)  # Ingress: the break-glass path (dev-joni)
    assert local.post("/api/v1/auth/second-factor/enroll").status_code == 200
    r = local.post("/api/v1/auth/second-factor/confirm", json={"code": code_now(arx, "dev-joni")})
    assert r.status_code == 200, r.text
    assert local.post("/api/v1/auth/recovery-codes").status_code == 200  # a factor exists, no sign-in age on the local channel


def test_n1_with_step_up_on_the_proof_still_adds_from_an_old_session(arx, clock):
    import test_mfa_devicekey_2490 as tdk

    # arx's fixture has the owner's switch ON
    enrol(arx, arx.viewer)
    clock.advance(6)  # the enrolment's own proof ran out
    _age_remote_sessions(STALE_S)
    r = tdk.register(arx, tdk.Phone())
    assert r.status_code == 403 and r.json()["code"] == "step_up_required", r.text  # a proof, not a re-sign-in, as before
    bump_step(arx, "u-viewer")
    assert arx.client.post(VERIFY, json={"method": "totp", "code": code_now(arx, "u-viewer")}).status_code == 200
    assert tdk.register(arx, tdk.Phone()).status_code == 200


# ---------------------------------------------------------------- N-5: an administrator's reset from outside needs a fresh sign-in

def _enrol_viewer_directly(arx) -> None:
    from test_mfa_reset_hardening_2510 import enrol_directly

    enrol_directly(arx, "u-viewer")


def test_n5_a_stale_administrator_session_resets_nobody_from_outside(arx):
    from test_mfa_reset_hardening_2510 import enrolled

    _off(arx)
    _enrol_viewer_directly(arx)
    assert fresh_login(arx, arx.owner).status_code == 200  # a system administrator with NO factor of its own
    _age_remote_sessions(STALE_S)
    check = arx.client.get(CHECK_VIEWER).json()
    assert check["allowed"] is False and check["reason"] == "reauth"
    r = arx.client.request("DELETE", RESET_VIEWER, json={"confirm": "dana"})
    assert r.status_code == 403 and r.json()["code"] == "reauth_required", r.text
    assert r.json()["details"] == {"action": "auth.second_factor.reset", "within_s": 300}
    row = [a for a in arx.audit("auth.second_factor.reset") if a["decision"] == "denied"][-1]
    assert row["reason"] == "reauth"
    assert enrolled(arx, "u-viewer")  # nothing removed
    # before the typed name: a stale session learns nothing from a wrong one either
    r = arx.client.request("DELETE", RESET_VIEWER, json={"confirm": "wrong"})
    assert r.json()["code"] == "reauth_required"
    assert fresh_login(arx, arx.owner).status_code == 200  # signing in again is the way
    assert arx.client.get(CHECK_VIEWER).json()["allowed"] is True
    r = arx.client.request("DELETE", RESET_VIEWER, json={"confirm": "dana"})
    assert r.status_code == 200, r.text
    assert not enrolled(arx, "u-viewer")


def test_n5_an_administrator_with_a_factor_still_gives_the_once_proof_after_signing_in(arx):
    _off(arx)
    _enrol_viewer_directly(arx)
    from test_mfa_reset_hardening_2510 import enrol_directly

    enrol_directly(arx, "u-owner")
    _sign_in_with_code(arx, arx.owner)  # fresh: the sign-in rule passes, the once-action proof is still asked
    r = arx.client.request("DELETE", RESET_VIEWER, json={"confirm": "dana"})
    assert r.status_code == 403 and r.json()["code"] == "second_factor_step_up_required", r.text


def test_n5_the_local_channel_is_not_limited(arx):
    _enrol_viewer_directly(arx)
    local = TestClient(arx.app)
    assert local.get("/api/v1/auth/second-factor/users/u-viewer/reset-check").json()["reason"] is None
    assert local.request("DELETE", "/api/v1/auth/second-factor/users/u-viewer", json={"confirm": "dana"}).status_code == 200


def test_n5_the_passkey_removal_of_an_arx_only_identity_from_a_stale_administrator_session(px: Px):
    px.configure()
    uid, _c, _auth = _with_passkey(px)
    pk = px.admin.get(f"/api/v1/identity/local-users/{uid}/passkeys").json()["credentials"][0]["id"]
    remote_admin = _remote_admin(px)  # a system administrator signed in from outside (no factor of its own)
    _age_remote_sessions(STALE_S)
    r = remote_admin.delete(f"/arx/api/v1/identity/local-users/{uid}/passkeys/{pk}")
    assert r.status_code == 403 and r.json()["code"] == "reauth_required", r.text
    assert len(px.admin.get(f"/api/v1/identity/local-users/{uid}/passkeys").json()["credentials"]) == 1
    refusal = [a for a in px.audit("identity.local.user.passkey_removed") if a["decision"] == "denied"]
    assert refusal and refusal[-1]["reason"] == "reauth_required"
    assert _notices(px.db, uid) == []
    px.client.cookies.clear()
    remote_admin = _remote_admin(px)  # signed in again (a new sign-in, not the old cookie)
    r = remote_admin.delete(f"/arx/api/v1/identity/local-users/{uid}/passkeys/{pk}")
    assert r.status_code == 200, r.text
    told = _notices(px.db, uid)  # N-6: the identity hears its passkey went
    assert len(told) == 1 and "מפתח גישה הוסר" in told[0]["body"]


# ---------------------------------------------------------------- N-6: the user is told, content-free

def test_n6_removing_the_authenticator_tells_the_user(arx, cheap_hashes):
    import test_mfa_recovery_codes_2490 as tr

    _off(arx)
    codes = tr.enrol_with_codes(arx, arx.viewer)
    bump_step(arx, "u-viewer")
    assert arx.client.post(DISABLE, json={"code": code_now(arx, "u-viewer")}).status_code == 200
    told = _notices(arx.db, "u-viewer")
    assert len(told) == 1 and "אפליקציית האימות הוסרה" in told[0]["body"]
    assert told[0]["title"] == "שינוי בדרכי האימות של החשבון"
    assert not any(c in json.dumps(told, ensure_ascii=False) for c in codes)


def test_n6_a_new_batch_of_recovery_codes_tells_the_user_without_a_code(arx, cheap_hashes):
    import test_mfa_recovery_codes_2490 as tr

    _off(arx)
    tr.enrol_with_codes(arx, arx.viewer)
    assert _notices(arx.db, "u-viewer") == []  # the enrolment's first batch is part of "a factor was added" (its own notice)
    r = arx.client.post(CODES)
    assert r.status_code == 200, r.text
    told = _notices(arx.db, "u-viewer")
    assert len(told) == 1 and "קודי שחזור חדשים" in told[0]["body"]
    text = json.dumps(told, ensure_ascii=False)
    assert not any(c in text or c.replace("-", "") in text for c in r.json()["codes"])


def test_n6_a_recovery_code_sign_in_tells_the_user(arx, cheap_hashes):
    import test_mfa_recovery_codes_2490 as tr

    _off(arx)
    codes = tr.enrol_with_codes(arx, arx.viewer)
    assert fresh_login(arx, arx.viewer, codes[0]).status_code == 200  # the second step answered with a recovery code
    told = _notices(arx.db, "u-viewer")
    assert len(told) == 1 and "קוד שחזור" in told[0]["body"]
    assert codes[0] not in json.dumps(told, ensure_ascii=False)
    _sign_in_with_code(arx, arx.viewer)  # an ordinary sign-in tells nothing
    assert len(_notices(arx.db, "u-viewer")) == 1


def test_n6_removing_a_phone_key_and_a_passkey_tells_the_user(arx):
    import test_mfa_devicekey_2490 as tdk
    import test_mfa_passkeys_2490 as tp

    _off(arx)
    tp.configure(arx)
    assert fresh_login(arx, arx.viewer).status_code == 200
    phone = tdk.Phone()
    assert tdk.register(arx, phone).status_code == 200
    assert arx.client.delete(f"{tdk.KEYS}/{phone.key_id}").status_code == 200
    _auth, added = tp.add_passkey(arx, arx.viewer, login=False)
    assert arx.client.delete(f"{tp.PK}/{added['passkey']['id']}").status_code == 200
    bodies = [n["body"] for n in _notices(arx.db, "u-viewer")]
    assert len(bodies) == 2 and "מפתח טלפון הוסר" in bodies[0] and "מפתח גישה הוסר" in bodies[1]
    assert "Pixel" not in "".join(bodies) and "laptop" not in "".join(bodies)  # never the label the user typed


def test_n6_the_arx_only_sign_in_path_and_the_other_recovery_uses(arx):
    assert fresh_login(arx, arx.viewer).status_code == 200  # the user is known to the directory (a notice needs a recipient)
    user = SimpleNamespace(user_id="u-viewer", username="dana", display_name="dana", source="ha")
    with arx.db.connection() as conn:
        rc.audit_use(conn, user, "local_sign_in")  # services/local_identity's second step
        rc.audit_use(conn, user, "step_up")  # a step-up proof or a removal is not a sign-in: no notice of its own
        rc.audit_use(conn, user, "disable")
        notify_sources.second_factor_changed(conn, "u-viewer", "something_else")  # an unknown change sends nothing
    told = _notices(arx.db, "u-viewer")
    assert len(told) == 1 and "קוד שחזור" in told[0]["body"]


def test_n6_the_source_is_in_the_catalogue_for_the_user_on_every_device():
    src = {s.key: s for s in notify_policy.SOURCES}[SOURCE]
    assert src.who == "initiator" and src.subject == "session" and src.app is True
    from smplwise.services.notify_policy_text import LABELS

    assert LABELS[SOURCE][0] == src.label and LABELS[SOURCE][1]
    assert set(notify_sources.FACTOR_CHANGES_HE) == {"removed:totp", "removed:passkey", "removed:device_key", "recovery_batch", "recovery_sign_in"}
