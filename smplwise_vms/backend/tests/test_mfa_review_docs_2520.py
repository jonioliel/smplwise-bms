"""MFA-REVIEW-DOCS-2520: regression tests of the small fixes made by the security review of the second factor as shipped in 2.51.0
(docs/security/MFA-REVIEW-2520.md):

* N-2 - removing an Arx-only identity's passkey by an administrator honours `security.factor_reset_channel = local` (it resets one of
  that user's authentication methods), audited; the default `any` is unchanged;
* N-3 - the last-administrator rule of the factor reset counts only a factor that answers a REMOTE SIGN-IN: a Home Assistant user's
  passkey is a step-up method, never a sign-in factor, so it does not make its holder an administrator who can sign in from outside;
* N-4 - a bearer sign-in admitted by Home Assistant's own MFA (the enforced sign-in factor policy) records no step-up proof - HA's MFA
  was shown when the refresh token was made, not now (the cookie exchange never recorded one either).

Fakes only (the fake HA core of tests/test_remote_access.py); no lab, no Home Assistant, no network."""
# ruff: noqa: F811 - the fixtures are imported by name and used as test parameters
from __future__ import annotations

from fastapi.testclient import TestClient

from smplwise.services import factor_reset as fr
from smplwise.services import step_up
from test_local_passkeys import Px, _remote_admin, _with_passkey, px  # noqa: F401 - `px` is a fixture
from test_mfa_passkeys_2490 import configure
from test_mfa_policy_2490 import _fresh_observations, listing, mfa_user, policy_settings, seen_row  # noqa: F401 - fixtures
from test_mfa_reset_hardening_2510 import admin, enrol_directly, enrolled, reset
from test_second_factor import arx  # noqa: F401 - `arx` is the fixture


# ---------------------------------------------------------------- N-2: the channel setting covers the passkey removal too

def test_n2_an_administrators_passkey_removal_honours_the_local_only_reset_channel(px: Px):
    px.configure()
    uid, _c, _auth = _with_passkey(px)
    pk = px.admin.get(f"/api/v1/identity/local-users/{uid}/passkeys").json()["credentials"][0]["id"]
    assert px.admin.patch("/api/v1/settings", json={"security.factor_reset_channel": "local"}).status_code == 200
    remote_admin = _remote_admin(px)  # a system administrator signed in from outside (no factor of its own)
    r = remote_admin.delete(f"/arx/api/v1/identity/local-users/{uid}/passkeys/{pk}")
    assert r.status_code == 403 and r.json()["code"] == "factor_reset_local_only", r.text
    assert len(px.admin.get(f"/api/v1/identity/local-users/{uid}/passkeys").json()["credentials"]) == 1  # nothing removed
    refusal = [a for a in px.audit("identity.local.user.passkey_removed") if a["decision"] == "denied"]
    assert refusal and refusal[-1]["reason"] == "local_only"
    # the default (`any`, owner Q53) is unchanged: once the owner widens it again (local channel only), the remote removal works
    assert px.admin.patch("/api/v1/settings", json={"security.factor_reset_channel": "any"}).status_code == 200
    r = remote_admin.request("DELETE", f"/arx/api/v1/identity/local-users/{uid}/passkeys/{pk}", json={"confirm": "maria"})
    assert r.status_code == 200, r.text


# ---------------------------------------------------------------- N-3: a passkey of a Home Assistant user is no remote sign-in factor

def _usable_passkey(arx, user_id: str) -> None:
    with arx.db.connection() as conn:
        conn.execute("INSERT INTO auth_webauthn_credentials(id, user_id, credential_id, public_key, alg, uv_registered, rp_id, created_at) "
                     "VALUES ('pk_n3', ?, 'cred-n3', 'cHVi', -7, 1, 'arx.example.com', '2026-11-25T00:00:00Z')", (user_id,))


def test_n3_a_passkey_only_administrator_does_not_count_as_one_who_can_sign_in_remotely(arx):
    configure(arx)  # the public address (relying party) - passkeys count
    arx.setting("security.second_factor_policy", "admins")  # an administrator must show a factor at a remote sign-in
    enrol_directly(arx, "u-owner")  # the one administrator who really can sign in from outside
    a = admin(arx)  # dev-joni, a system administrator whose ONLY factor is a passkey (a step-up method, not a sign-in factor)
    _usable_passkey(arx, "dev-joni")
    with arx.db.connection(mode="read") as conn:
        assert step_up.methods_of(conn, "dev-joni") == [step_up.METHOD_PASSKEY]
        assert not fr.signs_in_remotely(conn, "dev-joni", remote_on=True)  # under `admins` its remote sign-in goes to enrolment
        assert not fr.sign_in_factor(conn, "dev-joni")
        assert fr.sign_in_factor(conn, "u-owner") and fr.signs_in_remotely(conn, "u-owner", remote_on=True)
        assert fr.last_admin_blocks(conn, "u-owner", remote_on=True)
    assert a.get("/api/v1" + "/auth/second-factor/users/u-owner/reset-check").json()["reason"] == "last_admin"
    r = reset(a, "u-owner")
    assert r.status_code == 409 and r.json()["code"] == "factor_reset_last_admin", r.text
    assert enrolled(arx, "u-owner")


# ---------------------------------------------------------------- N-4: HA's MFA at a bearer sign-in is no step-up proof

def test_n4_a_bearer_sign_in_admitted_by_home_assistants_mfa_records_no_step_up_proof(arx, mfa_user, listing):
    policy_settings(arx, "all")  # the enforced sign-in factor policy: HA's own MFA (with provenance) may satisfy it
    seen_row(arx, "u-mfa")
    step_up.reset_for_tests()
    r = TestClient(arx.app).get("/arx/api/v1/me", headers={"Authorization": f"Bearer {arx.token(mfa_user)}"})
    assert r.status_code == 200, r.text
    assert listing["calls"] == 1  # the HA-MFA path was taken
    with step_up._MARK_LOCK:
        marks = [m for m in step_up._MARKS.values() if m.user_id == "u-mfa"]
    assert marks == [], f"HA's MFA at the refresh token's creation became a fresh step-up proof: {marks}"
