"""USR2 phase 4: passkeys (WebAuthn) of Arx-only identities - negative cases first.

A software authenticator (tests/webauthn_fake.py) stands in for a real device: no Chrome / Android / iOS here (real-device validation
is NOT_RUN - CR-USR2 section 10 has the checklist). Covered: the switch off, no public address, wrong origin, wrong RP id, a replayed
challenge, an expired challenge, a bad signature, a counter rollback, a cross-user credential, an administrative target without user
verification, the passkey-first switches, a deleted user's credential, a challenge used for another purpose, the fresh-sign-in rule,
the second-factor rule for administrative permissions (owner answer Q3), the backup rule, and that no audit row carries a credential id,
a public key, a challenge or a signature."""
from __future__ import annotations

import base64
import json
import time

import pytest

from test_local_identity import GOOD, Lx, _code, _cookie, _net
from webauthn_fake import FakeAuthenticator, b64u, cbor
from smplwise.services import ha_user_auth as hua
from smplwise.services import local_identity as li
from smplwise.services import local_passkeys as lpk
from smplwise.services import webauthn as wa

PUBLIC = "https://arx.example.com"
REG_OPTS = "/arx/api/v1/auth/passkeys/register/options"
REG = "/arx/api/v1/auth/passkeys/register"
SF_OPTS = "/arx/api/v1/auth/local/sign-in/passkey/options"
SF = "/arx/api/v1/auth/local/sign-in/passkey"
PL_OPTS = "/arx/api/v1/auth/local/passkey/options"
PL = "/arx/api/v1/auth/local/passkey"


class Px(Lx):
    def configure(self, *, first: bool = False) -> None:
        self.enable()
        body = {"security.local_public_url": PUBLIC}
        if first:
            body["security.local_passkey_first"] = "on"
        r = self.admin.patch("/api/v1/settings", json=body)
        assert r.status_code == 200, r.text

    def register(self, c, auth: FakeAuthenticator, **create_kw):
        opts = c.post(REG_OPTS)
        assert opts.status_code == 200, opts.text
        return c.post(REG, json={"credential": auth.create(opts.json(), **create_kw), "label": "phone"})

    def pending(self, username: str, password: str = GOOD, **headers):
        c = self.remote(**headers)
        r = self.sign_in(c, username, password)
        assert r.status_code == 202, r.text
        return c, r

    def age_sessions(self, user_id: str, seconds: float = 600) -> None:
        with self.db.connection() as conn:
            conn.execute("UPDATE auth_local_sessions SET chain_started_at = ? WHERE user_id = ?", (li.iso(time.time() - seconds), user_id))
        li.CACHE.clear()


@pytest.fixture()
def px(settings, tmp_path, monkeypatch):
    a = Px(settings, tmp_path, monkeypatch)
    yield a
    hua.reset_for_tests()


def _with_passkey(px: Px, username: str = "maria", role: str = "viewer", **auth_kw):
    created, c = px.ready(username, role)
    auth = FakeAuthenticator(**auth_kw)
    r = px.register(c, auth)
    assert r.status_code == 201, r.text
    return created["user"]["id"], c, auth


# ---------------------------------------------------------------- 1. switches and availability

def test_off_every_passkey_route_refuses_and_nothing_changes(px):
    c = px.remote()
    for path in (SF_OPTS, PL_OPTS):
        r = c.post(path)
        assert r.status_code == 403 and r.json()["code"] == "local_identity_off"
    for path in (SF, PL):
        r = c.post(path, json={"credential": {}})
        assert r.status_code == 403 and r.json()["code"] == "local_identity_off"
    assert set(px.client.get("/arx/api/v1/auth/remote-config").json()) == {"path", "session", "idle_lock_minutes"}
    assert px.admin.get("/.well-known/assetlinks.json").status_code == 404
    # the local channel never offers the public passkey routes
    px.enable()
    assert px.admin.post("/api/v1/auth/local/passkey/options", headers={"Origin": "http://testserver"}).status_code == 404


def test_unavailable_without_a_public_address(px):
    px.enable()
    created, c = px.ready("maria")
    r = c.get("/arx/api/v1/auth/passkeys")
    assert r.status_code == 200 and r.json()["available"] is False and r.json()["credentials"] == []
    r = c.post(REG_OPTS)
    assert r.status_code == 409 and r.json()["code"] == "passkey_unavailable"
    assert px.client.get("/arx/api/v1/auth/remote-config").json().get("local_passkey_first") is None


def test_passkey_routes_are_for_local_identities_only(px):
    px.configure()
    px.flag("u-viewer")
    px.bind("u-viewer", "viewer")
    assert px.login(px.viewer).status_code == 200
    r = px.client.get("/arx/api/v1/auth/passkeys")
    assert r.status_code == 403 and r.json()["code"] == "not_local_identity"
    assert px.client.post(REG_OPTS).status_code == 403


# ---------------------------------------------------------------- 2. registration negatives

def test_registration_needs_a_fresh_sign_in(px):
    px.configure()
    created, c = px.ready("maria")
    px.age_sessions(created["user"]["id"])
    r = c.post(REG_OPTS)
    assert r.status_code == 403 and r.json()["code"] == "reauth_required"
    assert c.get("/arx/api/v1/auth/passkeys").json()["recent_auth"] is False


@pytest.mark.parametrize("breakage, reason", [
    ({"origin": "https://evil.example.com"}, "wrong_origin"),
    ({"rp_id": "evil.example.com"}, "wrong_rp_id"),
    ({"challenge": b64u(b"\x00" * 32)}, "challenge_unknown"),
    ({"kind": "webauthn.get"}, "wrong_type"),
    ({"up": False}, "no_user_presence"),
    ({"raw_id": b"\x01" * 32}, "credential_id_mismatch"),
])
def test_registration_refuses_every_broken_part_uniformly(px, breakage, reason):
    px.configure()
    created, c = px.ready("maria")
    r = px.register(c, FakeAuthenticator(), **breakage)
    assert r.status_code == 400 and r.json()["code"] == "passkey_invalid" and r.json()["user_message"] == lpk.REGISTER_FAILED_HE
    assert px.rows("SELECT id FROM auth_webauthn_credentials") == []
    assert px.audit("auth.local.passkey.refused")[-1]["reason"] == reason


def test_registration_challenge_is_single_use_and_expires(px):
    px.configure()
    created, c = px.ready("maria")
    auth = FakeAuthenticator()
    opts = c.post(REG_OPTS).json()
    cred = auth.create(opts)
    assert c.post(REG, json={"credential": cred}).status_code == 201
    replay = c.post(REG, json={"credential": cred})  # the same challenge again
    assert replay.status_code == 400 and px.audit("auth.local.passkey.refused")[-1]["reason"] == "challenge_unknown"
    opts = c.post(REG_OPTS).json()
    for ch in lpk.all_challenges():
        ch.created -= lpk.CHALLENGE_TTL_S + 1
    r = c.post(REG, json={"credential": FakeAuthenticator().create(opts)})
    assert r.status_code == 400 and px.audit("auth.local.passkey.refused")[-1]["reason"] == "challenge_unknown"


def test_registration_challenge_is_bound_to_its_session_and_user(px):
    px.configure()
    _ca, ca = px.ready("anna")
    _cb, cb = px.ready("boris")
    opts_a = ca.post(REG_OPTS).json()
    r = cb.post(REG, json={"credential": FakeAuthenticator().create(opts_a)})  # boris posts anna's ceremony
    assert r.status_code == 400 and px.audit("auth.local.passkey.refused")[-1]["reason"] == "challenge_mismatch"


def test_an_administrative_target_must_register_with_user_verification(px):
    px.configure()
    created = px.create("sitey", "site_admin")
    assert px.set_password(px.link_token(created)).status_code == 200
    c = px.remote()
    assert px.sign_in(c, "sitey").status_code == 200
    opts = c.post(REG_OPTS).json()
    assert opts["publicKey"]["authenticatorSelection"]["userVerification"] == "required" and opts["user_verification_required"] is True
    r = c.post(REG, json={"credential": FakeAuthenticator(uv=False).create(opts)})
    assert r.status_code == 400 and px.audit("auth.local.passkey.refused")[-1]["reason"] == "no_user_verification"


def test_a_credential_id_registered_twice_is_refused_also_across_users(px):
    px.configure()
    uid, c, auth = _with_passkey(px, "anna")
    _created, cb = px.ready("boris")
    r = px.register(cb, auth)  # the same authenticator credential presented by another user
    assert r.status_code == 400 and px.audit("auth.local.passkey.refused")[-1]["reason"] == "credential_exists"
    assert [r["user_id"] for r in px.rows("SELECT user_id FROM auth_webauthn_credentials")] == [uid]


def test_a_user_who_has_totp_registers_only_from_a_session_that_showed_it(px):
    px.configure()
    created, c = px.ready("maria")
    secret = c.post("/arx/api/v1/auth/second-factor/enroll").json()["secret"]
    assert c.post("/arx/api/v1/auth/second-factor/confirm", json={"code": _code(secret)}).status_code == 200
    # the enrolment rotated this session with the factor: registering works
    assert px.register(c, FakeAuthenticator()).status_code == 201
    # a session without the factor cannot exist for an enrolled user; simulate one that lost it
    with px.db.connection() as conn:
        conn.execute("UPDATE auth_local_sessions SET factor_at = NULL WHERE user_id = ?", (created["user"]["id"],))
    li.CACHE.clear()
    assert c.post(REG_OPTS).json()["code"] == "reauth_required"


# ---------------------------------------------------------------- 3. the second factor (owner answer Q3)

def test_the_pending_step_offers_a_passkey_and_a_totp_only_answer_is_unchanged(px):
    px.configure()
    created, c = px.ready("maria")
    secret = c.post("/arx/api/v1/auth/second-factor/enroll").json()["secret"]
    assert c.post("/arx/api/v1/auth/second-factor/confirm", json={"code": _code(secret)}).status_code == 200
    _c2, r = px.pending("maria")
    assert r.json() == {"second_factor": "required"}  # TOTP only: byte-for-byte the phase-1 answer
    assert px.register(c, FakeAuthenticator()).status_code == 201
    _c3, r = px.pending("maria")
    assert r.json() == {"second_factor": "required", "methods": ["totp", "passkey"]}


def test_passkey_options_need_the_pending_cookie(px):
    px.configure()
    _with_passkey(px)
    r = px.remote().post(SF_OPTS)
    assert r.status_code == 401 and r.json()["code"] == "second_factor_expired"


def test_second_factor_negatives(px):
    px.configure()
    uid, c, auth = _with_passkey(px)
    c2, _ = px.pending("maria")
    # wrong origin, wrong RP id, bad signature, a challenge of another purpose: each a uniform 401 and the step stays usable
    for kw, reason in (({"origin": "https://evil.example.com"}, "wrong_origin"), ({"rp_id": "evil.example.com"}, "wrong_rp_id"),
                       ({"tamper": True}, "bad_signature")):
        opts = c2.post(SF_OPTS).json()
        r = c2.post(SF, json={"credential": auth.get(opts, **kw)})
        assert r.status_code == 401 and r.json()["code"] == "passkey_invalid" and r.json()["user_message"] == lpk.INVALID_HE
        assert px.audit("auth.local.passkey.refused")[-1]["reason"] == reason
    assert c2.get("/arx/api/v1/me").status_code == 401
    # the step allows PENDING_MAX_ATTEMPTS answers in all: 3 used, the 4th works
    opts = c2.post(SF_OPTS).json()
    r = c2.post(SF, json={"credential": auth.get(opts)})
    assert r.status_code == 200 and "arx_session=l." in _cookie(r)
    assert c2.get("/arx/api/v1/me").json()["user"]["id"] == uid


def test_second_factor_replayed_and_expired_challenges(px):
    px.configure()
    _uid, _c, auth = _with_passkey(px)
    c2, _ = px.pending("maria")
    opts = c2.post(SF_OPTS).json()
    cred = auth.get(opts)
    assert c2.post(SF, json={"credential": cred}).status_code == 200
    c3, _ = px.pending("maria")
    r = c3.post(SF, json={"credential": cred})  # a recorded assertion replayed on a new pending step
    assert r.status_code == 401 and px.audit("auth.local.passkey.refused")[-1]["reason"] == "challenge_unknown"
    opts = c3.post(SF_OPTS).json()
    for ch in lpk.all_challenges():
        ch.created -= lpk.CHALLENGE_TTL_S + 1
    r = c3.post(SF, json={"credential": auth.get(opts)})
    assert r.status_code == 401 and px.audit("auth.local.passkey.refused")[-1]["reason"] == "challenge_unknown"


def test_counter_rollback_is_refused_and_audited_as_a_clone(px):
    px.configure()
    uid, _c, auth = _with_passkey(px)
    c2, _ = px.pending("maria")
    assert c2.post(SF, json={"credential": auth.get(c2.post(SF_OPTS).json(), counter=5)}).status_code == 200
    c3, _ = px.pending("maria")
    r = c3.post(SF, json={"credential": auth.get(c3.post(SF_OPTS).json(), counter=3)})
    assert r.status_code == 401
    row = px.audit("auth.local.passkey.counter_regression")[-1]
    assert row["resource_id"] == uid and row["reason"] == "counter_regression"
    assert px.rows("SELECT sign_count FROM auth_webauthn_credentials") == [{"sign_count": 5}]
    assert c3.post(SF_OPTS).status_code == 401  # a clone suspicion ends the pending step


def test_an_authenticator_without_a_counter_is_accepted(px):
    px.configure()
    _uid, _c, auth = _with_passkey(px, counting=False)
    for _ in range(2):
        c2, _ = px.pending("maria")
        assert c2.post(SF, json={"credential": auth.get(c2.post(SF_OPTS).json())}).status_code == 200


def test_cross_user_credential_is_refused(px):
    px.configure()
    _ua, _ca, auth_a = _with_passkey(px, "anna")
    _ub, _cb, _auth_b = _with_passkey(px, "boris")
    c2, _ = px.pending("boris")
    opts = c2.post(SF_OPTS).json()
    r = c2.post(SF, json={"credential": auth_a.get(opts, user_handle=None)})  # anna's passkey on boris's step
    assert r.status_code == 401 and px.audit("auth.local.passkey.refused")[-1]["reason"] == "cross_user"
    assert c2.get("/arx/api/v1/me").status_code == 401


def test_an_administrative_target_needs_uv_and_a_passkey_opens_its_administrative_permissions(px):
    px.configure()
    created = px.create("sitey", "site_admin")
    uid = created["user"]["id"]
    assert px.set_password(px.link_token(created)).json() == {"must_enrol": True}
    c = px.remote()
    assert px.sign_in(c, "sitey").json()["second_factor"] == "enroll_required"
    assert c.get("/arx/api/v1/access/bindings").status_code == 403  # Q3: blocked until a factor
    auth = FakeAuthenticator()
    r = px.register(c, auth)
    assert r.status_code == 201 and r.json()["first_factor"] is True and "arx_session=l." in _cookie(r)
    assert c.get("/arx/api/v1/access/bindings").status_code == 200  # the in-session enrolment counts (F10, like TOTP)
    assert c.get("/arx/api/v1/me").json()["local_identity"]["admin_permissions_blocked"] is False
    # a new sign-in: the step needs UV for an administrative user
    c2, r = px.pending("sitey")
    assert r.json()["methods"] == ["passkey"]
    opts = c2.post(SF_OPTS).json()
    assert opts["publicKey"]["userVerification"] == "required"
    r = c2.post(SF, json={"credential": auth.get(opts, uv=False)})
    assert r.status_code == 401 and px.audit("auth.local.passkey.refused")[-1]["reason"] == "no_user_verification"
    r = c2.post(SF, json={"credential": auth.get(c2.post(SF_OPTS).json())})
    assert r.status_code == 200
    assert c2.get("/arx/api/v1/access/bindings").status_code == 200
    ok = [a for a in px.audit("auth.local.sign_in.succeeded") if a["resource_id"] == uid]
    assert json.loads(ok[-1]["details_json"] if "details_json" in ok[-1] else ok[-1]["details"])["factor"] == "passkey"


def test_a_non_administrative_user_may_answer_without_uv(px):
    px.configure()
    _uid, _c, auth = _with_passkey(px, uv=False)
    c2, _ = px.pending("maria")
    opts = c2.post(SF_OPTS).json()
    assert opts["publicKey"]["userVerification"] == "preferred"
    assert c2.post(SF, json={"credential": auth.get(opts)}).status_code == 200


def test_a_required_policy_gate_lifts_with_a_passkey(px):
    px.configure()
    created = px.create("maria")
    uid = created["user"]["id"]
    assert px.admin.put(f"/api/v1/auth/second-factor/overrides/user/{uid}", json={"policy": "required"}).status_code == 200
    assert px.set_password(px.link_token(created)).status_code == 200
    c = px.remote()
    assert px.sign_in(c, "maria").json()["second_factor"] == "enroll_required"
    assert c.get("/arx/api/v1/sites").json()["code"] == "second_factor_enrollment_required"
    assert px.register(c, FakeAuthenticator()).status_code == 201  # the passkey routes are an enrolment path
    assert c.get("/arx/api/v1/sites").status_code == 200


def test_a_changed_public_address_never_leaves_a_user_at_an_unpassable_step(px):
    px.configure()
    _uid, _c, _auth = _with_passkey(px)
    assert px.admin.patch("/api/v1/settings", json={"security.local_public_url": "https://other.example.com"}).status_code == 200
    r = px.sign_in(px.remote(), "maria")
    assert r.status_code == 200 and r.json()["second_factor"] == "none"  # the old-RP passkey does not count; the password signs in
    listed = _c.get("/arx/api/v1/auth/passkeys").json()["credentials"] if _c.get("/arx/api/v1/me").status_code == 200 else None
    assert listed is None or listed[0]["usable"] is False


def test_me_tells_the_shell_about_passkeys(px):
    px.configure()
    created, c = px.ready("maria")
    li_block = c.get("/arx/api/v1/me").json()["local_identity"]
    assert li_block["passkeys"] == 0 and li_block["factor_enrolled"] is False
    assert px.register(c, FakeAuthenticator()).status_code == 201
    li_block = c.get("/arx/api/v1/me").json()["local_identity"]
    assert li_block["passkeys"] == 1 and li_block["factor_enrolled"] is True and li_block["second_factor_enrolled"] is False


# ---------------------------------------------------------------- 4. passkey first (passwordless)

def test_passwordless_needs_the_owner_switch_and_the_users_opt_in(px):
    px.configure()
    uid, c, auth = _with_passkey(px)
    c2 = px.remote()
    r = c2.post(PL_OPTS)
    assert r.status_code == 403 and r.json()["code"] == "passkey_first_off"
    assert c.put("/arx/api/v1/auth/passkeys/first", json={"on": True}).json()["code"] == "passkey_first_off"
    assert px.admin.patch("/api/v1/settings", json={"security.local_passkey_first": "on"}).status_code == 200
    assert px.client.get("/arx/api/v1/auth/remote-config").json()["local_passkey_first"] is True
    opts = c2.post(PL_OPTS).json()
    assert opts["publicKey"]["userVerification"] == "required" and opts["publicKey"]["allowCredentials"] == []
    r = c2.post(PL, json={"credential": auth.get(opts)})
    assert r.status_code == 401 and r.json()["code"] == "passkey_invalid"  # not opted in
    assert px.audit("auth.local.passkey.refused")[-1]["reason"] == "user_not_opted_in"
    r = c.put("/arx/api/v1/auth/passkeys/first", json={"on": True})
    assert r.status_code == 200 and r.json()["first_on"] is True
    r = c2.post(PL, json={"credential": auth.get(c2.post(PL_OPTS).json())})
    assert r.status_code == 200 and "arx_session=l." in _cookie(r)
    assert c2.get("/arx/api/v1/me").json()["user"]["id"] == uid
    # the owner switch off: refused again, and the password still works (never a lock-out)
    assert px.admin.patch("/api/v1/settings", json={"security.local_passkey_first": "off"}).status_code == 200
    assert px.remote().post(PL_OPTS).status_code == 403
    assert px.sign_in(px.remote(), "maria").status_code == 202  # the password + the passkey as second factor


def test_passwordless_negatives(px):
    px.configure(first=True)
    uid, c, auth = _with_passkey(px)
    assert c.put("/arx/api/v1/auth/passkeys/first", json={"on": True}).status_code == 200
    c2 = px.remote()
    for kw, reason in (({"uv": False}, "no_user_verification"), ({"user_handle": None}, "user_handle_mismatch"),
                       ({"user_handle": b"\x00" * 32}, "user_handle_mismatch"), ({"origin": "https://evil.example.com"}, "wrong_origin"),
                       ({"tamper": True}, "bad_signature")):
        r = c2.post(PL, json={"credential": auth.get(c2.post(PL_OPTS).json(), **kw)})
        assert r.status_code == 401 and r.json() == {**r.json(), "code": "passkey_invalid", "user_message": lpk.INVALID_HE}, kw
        assert px.audit("auth.local.passkey.refused")[-1]["reason"] == reason, kw
    # a second-factor challenge cannot be spent on the passwordless route
    c3, _ = px.pending("maria")
    sf_opts = c3.post(SF_OPTS).json()
    r = c2.post(PL, json={"credential": auth.get(sf_opts)})
    assert r.status_code == 401 and px.audit("auth.local.passkey.refused")[-1]["reason"] == "challenge_mismatch"
    # an unknown credential: the same answer
    stranger = FakeAuthenticator()
    stranger.user_handle = b"\x01" * 32
    r = c2.post(PL, json={"credential": stranger.get(c2.post(PL_OPTS).json())})
    assert r.status_code == 401 and r.json()["code"] == "passkey_invalid"


def test_a_deleted_or_disabled_users_credential_never_signs_in(px):
    px.configure(first=True)
    uid, c, auth = _with_passkey(px)
    assert c.put("/arx/api/v1/auth/passkeys/first", json={"on": True}).status_code == 200
    assert px.admin.patch(f"/api/v1/identity/local-users/{uid}", json={"active": False}).status_code == 200
    c2 = px.remote()
    r = c2.post(PL, json={"credential": auth.get(c2.post(PL_OPTS).json())})
    assert r.status_code == 401 and px.audit("auth.local.passkey.refused")[-1]["reason"] == "user_inactive"
    assert px.admin.patch(f"/api/v1/identity/local-users/{uid}", json={"active": True}).status_code == 200
    assert px.admin.delete(f"/api/v1/identity/local-users/{uid}").status_code == 200
    r = c2.post(PL, json={"credential": auth.get(c2.post(PL_OPTS).json())})
    assert r.status_code == 401 and px.audit("auth.local.passkey.refused")[-1]["reason"] == "user_inactive"


def test_passwordless_shares_the_sign_in_per_address_tier(px):
    px.configure(first=True)
    c = px.remote(**_net(77))
    codes = [c.post(PL, json={"credential": {"type": "public-key"}}).status_code for _ in range(li.IP_WINDOWS[0][1] + 1)]
    assert codes[:-1] == [401] * li.IP_WINDOWS[0][1] and codes[-1] == 429
    # the password route from the same address is in the same budget
    assert px.sign_in(c, "nobody", "whatever password").status_code == 429


def test_passkey_first_never_removes_the_password_and_the_last_passkey_switches_it_off(px):
    px.configure(first=True)
    uid, c, auth = _with_passkey(px)
    assert c.put("/arx/api/v1/auth/passkeys/first", json={"on": True}).status_code == 200
    assert px.rows("SELECT password_hash IS NOT NULL AS has FROM auth_local_credentials WHERE user_id = ?", (uid,)) == [{"has": 1}]
    pk = c.get("/arx/api/v1/auth/passkeys").json()["credentials"][0]["id"]
    r = c.delete(f"/arx/api/v1/auth/passkeys/{pk}")
    assert r.status_code == 200 and r.json()["passkey_first"] is False and r.json()["credentials"] == []
    assert px.audit("auth.local.passkey.first_disabled")[-1]["reason"] == "last_passkey_removed"
    assert px.sign_in(px.remote(), "maria").status_code == 200  # password only again (no factor left)


# ---------------------------------------------------------------- 5. removal, administration, the password change

def test_removing_a_passkey_needs_a_fresh_sign_in_or_the_totp_code(px):
    px.configure()
    uid, c, _auth = _with_passkey(px)
    pk = c.get("/arx/api/v1/auth/passkeys").json()["credentials"][0]["id"]
    px.age_sessions(uid)
    r = c.delete(f"/arx/api/v1/auth/passkeys/{pk}")
    assert r.status_code == 403 and r.json()["code"] == "reauth_required"
    assert c.delete("/arx/api/v1/auth/passkeys/pk_nope").status_code == 404


def test_an_administrator_removes_a_users_passkey_and_every_session_ends(px):
    px.configure()
    uid, c, _auth = _with_passkey(px)
    listed = px.admin.get(f"/api/v1/identity/local-users/{uid}/passkeys").json()
    assert len(listed["credentials"]) == 1 and "credential_id" not in listed["credentials"][0] and "public_key" not in listed["credentials"][0]
    assert px.admin.get(f"/api/v1/identity/local-users/{uid}").json()["passkeys"] == 1
    pk = listed["credentials"][0]["id"]
    # a viewer cannot; the passkey of another user cannot be addressed through this user
    px.admin.get("/api/v1/me", headers={"X-SW-Dev-User": "dana"})
    px.bind("dev-dana", "viewer")
    assert px.admin.delete(f"/api/v1/identity/local-users/{uid}/passkeys/{pk}", headers={"X-SW-Dev-User": "dana"}).status_code == 403
    r = px.admin.delete(f"/api/v1/identity/local-users/{uid}/passkeys/{pk}")
    assert r.status_code == 200 and r.json()["sessions_ended"] == 1
    assert c.get("/arx/api/v1/me").status_code == 401
    assert px.audit("identity.local.user.passkey_removed")
    # the administrator may switch the passkey-first mode off, never on
    r = px.admin.patch(f"/api/v1/identity/local-users/{uid}", json={"passkey_first": True})
    assert r.status_code == 422 and r.json()["code"] == "passkey_first_self_only"


def test_a_passkey_only_user_changes_the_password_only_after_a_fresh_passkey_sign_in(px):
    px.configure()
    uid, c, auth = _with_passkey(px)
    c2, _ = px.pending("maria")
    assert c2.post(SF, json={"credential": auth.get(c2.post(SF_OPTS).json())}).status_code == 200
    px.age_sessions(uid)
    r = c2.put("/arx/api/v1/auth/local/password", json={"current_password": GOOD, "new_password": "quiet orange harbour 12"})
    assert r.status_code == 403 and r.json()["code"] == "reauth_required"
    c3, _ = px.pending("maria")
    assert c3.post(SF, json={"credential": auth.get(c3.post(SF_OPTS).json())}).status_code == 200
    r = c3.put("/arx/api/v1/auth/local/password", json={"current_password": GOOD, "new_password": "quiet orange harbour 12"})
    assert r.status_code == 200, r.text


# ---------------------------------------------------------------- 6. backup, settings, audit hygiene, assetlinks

def test_backup_carries_public_keys_only_and_never_the_passkey_settings(px):
    from smplwise.services import backup

    px.configure(first=True)
    uid, _c, auth = _with_passkey(px)
    assert "auth_webauthn_credentials" in backup.ACCESS_TABLES
    with px.db.connection(mode="read") as conn:
        snap = backup.snapshot(conn)
    rows = snap["auth_webauthn_credentials"]
    assert len(rows) == 1 and rows[0]["user_id"] == uid and wa.b64url_decode(rows[0]["public_key"]) == auth.cose()
    assert not any("challenge" in t for t in snap)
    keys = {r["key"] for r in snap.get("settings", [])}
    assert "security.local_passkey_first" not in keys and "security.local_passkey_android" not in keys
    json.dumps(snap)  # the archive is JSON: every column must serialise (TEXT, not BLOB)


def test_passkey_settings_are_system_administrator_only_and_validated(px):
    px.configure()
    px.admin.get("/api/v1/me", headers={"X-SW-Dev-User": "sami"})
    px.bind("dev-sami", "site_admin")
    r = px.admin.patch("/api/v1/settings", json={"security.local_passkey_first": "on"}, headers={"X-SW-Dev-User": "sami"})
    assert r.status_code == 403
    assert px.admin.get("/api/v1/settings").json()["settings"]["security.local_passkey_first"] == "off"
    assert px.admin.patch("/api/v1/settings", json={"security.local_passkey_android": "not a package"}).status_code == 422
    fp = ":".join(["AB"] * 32)
    assert px.admin.patch("/api/v1/settings", json={"security.local_passkey_android": f"com.smplwise.arx.app:{fp.lower()}"}).status_code == 200
    r = px.admin.get("/.well-known/assetlinks.json")
    assert r.status_code == 200 and r.json() == [{"relation": ["delegate_permission/common.get_login_creds"],
                                                  "target": {"namespace": "android_app", "package_name": "com.smplwise.arx.app", "sha256_cert_fingerprints": [fp]}}]
    px.enable(False)
    assert px.admin.get("/.well-known/assetlinks.json").status_code == 404


def test_no_audit_row_or_log_carries_a_credential_id_a_key_a_challenge_or_a_signature(px, caplog):
    import logging

    caplog.set_level(logging.DEBUG)
    px.configure(first=True)
    uid, c, auth = _with_passkey(px)
    assert c.put("/arx/api/v1/auth/passkeys/first", json={"on": True}).status_code == 200
    c2 = px.remote()
    opts = c2.post(PL_OPTS).json()
    cred = auth.get(opts)
    assert c2.post(PL, json={"credential": cred}).status_code == 200
    secrets_seen = {b64u(auth.credential_id), b64u(auth.cose()), opts["publicKey"]["challenge"], cred["response"]["signature"]}
    with px.db.connection(mode="read") as conn:
        dump = json.dumps([dict(r) for r in conn.execute("SELECT * FROM audit_log").fetchall()], default=str)
    assert not any(s in dump for s in secrets_seen)
    assert not any(s in caplog.text for s in secrets_seen)


# ---------------------------------------------------------------- 6b. security review RELEASE_264 (private/planning/RELEASE_264_REVIEW_USR2_P4.md)

def _code_at(secret_b32: str, offset: int) -> str:
    from smplwise.services import second_factor as sf

    pad = "=" * (-len(secret_b32) % 8)
    return sf.hotp(base64.b32decode(secret_b32 + pad), sf.step_of() + offset)


def _admin_ready(px: Px, username: str = "sitey"):
    created = px.create(username, "site_admin")
    assert px.set_password(px.link_token(created)).status_code == 200
    c = px.remote()
    assert px.sign_in(c, username).json()["second_factor"] == "enroll_required"
    return created["user"]["id"], c


def test_f3_a_non_uv_passkey_and_a_later_administrative_role_never_make_an_unpassable_step(px):
    """F3: the non-UV passkey would be offered as THE factor while every assertion is refused for lack of UV. It no longer counts for an
    administrative user: the password signs in to the enrolment path, the administrative permissions stay closed, and a UV passkey
    registered from that session becomes the factor."""
    px.configure()
    uid, _c, weak = _with_passkey(px, uv=False)
    assert px.rows("SELECT uv_registered FROM auth_webauthn_credentials") == [{"uv_registered": 0}]
    px.bind(uid, "site_admin")  # an administrative role arrives later
    li.CACHE.clear()
    c = px.remote()
    r = px.sign_in(c, "maria")
    assert r.status_code == 200 and r.json()["second_factor"] == "enroll_required", r.text  # never a 202 step nothing can pass
    assert c.get("/arx/api/v1/access/bindings").status_code == 403  # Q3: administrative permissions closed without a factor
    me = c.get("/arx/api/v1/me").json()["local_identity"]
    assert me["factor_enrolled"] is False and me["passkeys"] == 0
    listed = c.get("/arx/api/v1/auth/passkeys").json()["credentials"]
    assert len(listed) == 1 and listed[0]["usable"] is False and listed[0]["user_verifying"] is False
    # the way out: a UV passkey from this ordinary session (no factor yet -> a fresh sign-in suffices)
    strong = FakeAuthenticator()
    r = px.register(c, strong)
    assert r.status_code == 201 and r.json()["first_factor"] is True
    assert c.get("/arx/api/v1/access/bindings").status_code == 200
    c2, r = px.pending("maria")
    assert r.json()["methods"] == ["passkey"]
    opts = c2.post(SF_OPTS).json()
    assert [a["id"] for a in opts["publicKey"]["allowCredentials"]] == [b64u(strong.credential_id)]  # the weak key is never offered
    assert c2.post(SF, json={"credential": weak.get(opts)}).status_code == 401
    assert c2.post(SF, json={"credential": strong.get(c2.post(SF_OPTS).json())}).status_code == 200


def test_f3_a_non_administrative_users_non_uv_passkey_still_counts(px):
    px.configure()
    _uid, _c, _auth = _with_passkey(px, uv=False)
    _c2, r = px.pending("maria")
    assert r.json()["methods"] == ["passkey"]


def test_f2_removing_the_last_passkey_closes_the_administrative_permissions_of_the_current_session(px):
    px.configure()
    uid, c = _admin_ready(px)
    assert px.register(c, FakeAuthenticator()).status_code == 201
    assert c.get("/arx/api/v1/access/bindings").status_code == 200  # the first factor made in-session counts (F10)
    pk = c.get("/arx/api/v1/auth/passkeys").json()["credentials"][0]["id"]
    r = c.delete(f"/arx/api/v1/auth/passkeys/{pk}")  # a fresh sign-in: allowed
    assert r.status_code == 200 and r.json()["factor_cleared"] is True, r.text
    assert c.get("/arx/api/v1/me").status_code == 200  # the session stays (the user re-enrols from it) ...
    assert c.get("/arx/api/v1/access/bindings").status_code == 403  # ... but no longer with the administrative permissions
    assert c.get("/arx/api/v1/me").json()["local_identity"]["admin_permissions_blocked"] is True
    assert px.rows("SELECT COUNT(*) AS n FROM auth_local_sessions WHERE user_id = ? AND factor_at IS NOT NULL", (uid,)) == [{"n": 0}]
    removed = px.audit("auth.local.passkey.removed")[-1]
    assert json.loads(removed["details_json"])["factor_cleared"] is True


def test_f2_removing_one_of_two_factors_keeps_the_session_verified(px):
    px.configure()
    uid, c = _admin_ready(px)
    assert px.register(c, FakeAuthenticator()).status_code == 201
    assert px.register(c, FakeAuthenticator()).status_code == 201
    pk = c.get("/arx/api/v1/auth/passkeys").json()["credentials"][0]["id"]
    r = c.delete(f"/arx/api/v1/auth/passkeys/{pk}")
    assert r.status_code == 200 and r.json()["factor_cleared"] is False
    assert c.get("/arx/api/v1/access/bindings").status_code == 200


def test_f2_disabling_totp_as_the_last_factor_closes_the_administrative_permissions(px):
    px.configure()
    uid, c = _admin_ready(px)
    secret = c.post("/arx/api/v1/auth/second-factor/enroll").json()["secret"]
    assert c.post("/arx/api/v1/auth/second-factor/confirm", json={"code": _code_at(secret, 0)}).status_code == 200
    assert c.get("/arx/api/v1/access/bindings").status_code == 200
    r = c.post("/arx/api/v1/auth/second-factor/disable", json={"code": _code_at(secret, 1)})
    assert r.status_code == 200 and r.json()["enabled"] is False, r.text
    assert c.get("/arx/api/v1/me").status_code == 200
    assert c.get("/arx/api/v1/access/bindings").status_code == 403
    assert px.rows("SELECT COUNT(*) AS n FROM auth_local_sessions WHERE user_id = ? AND factor_at IS NOT NULL", (uid,)) == [{"n": 0}]
    assert json.loads(px.audit("auth.second_factor.removed")[-1]["details_json"])["factor_cleared"] is True


def test_f2_disabling_totp_while_a_passkey_remains_keeps_the_session_verified(px):
    px.configure()
    uid, c = _admin_ready(px)
    secret = c.post("/arx/api/v1/auth/second-factor/enroll").json()["secret"]
    assert c.post("/arx/api/v1/auth/second-factor/confirm", json={"code": _code_at(secret, 0)}).status_code == 200
    assert px.register(c, FakeAuthenticator()).status_code == 201
    assert c.post("/arx/api/v1/auth/second-factor/disable", json={"code": _code_at(secret, 1)}).status_code == 200
    assert c.get("/arx/api/v1/access/bindings").status_code == 200


def test_f1_a_flood_of_passwordless_options_never_blocks_registration_or_the_second_step(px, monkeypatch):
    px.configure(first=True)
    monkeypatch.setattr(lpk, "MAX_PASSWORDLESS", 40)
    uid, c, auth = _with_passkey(px)
    for n in range(400):  # many addresses (a botnet / an IPv6 /48): far more than the pool holds
        lpk.passwordless_options(px.db, f"2001:db8:{n:x}::/64")
    assert lpk.live_challenges("passwordless") == 40  # full, evicting its oldest - never a 429
    r = c.post(REG_OPTS)
    assert r.status_code == 200, r.text  # registration is in its own pool
    c2, _ = px.pending("maria")
    opts = c2.post(SF_OPTS)
    assert opts.status_code == 200, opts.text  # so is the second step
    assert c2.post(SF, json={"credential": auth.get(opts.json())}).status_code == 200
    # a passwordless ceremony started after the flood still works (the flood only evicted its own entries)
    assert c.put("/arx/api/v1/auth/passkeys/first", json={"on": True}).status_code == 200
    c3 = px.remote()
    r = c3.post(PL, json={"credential": auth.get(c3.post(PL_OPTS).json())})
    assert r.status_code == 200, r.text


def test_f1_one_address_holds_only_a_handful_of_live_passwordless_challenges(px):
    px.configure(first=True)
    first = [lpk.passwordless_options(px.db, "198.51.100.7")["publicKey"]["challenge"] for _ in range(10)]
    assert lpk.live_challenges("passwordless") == lpk.PASSWORDLESS_PER_ADDRESS
    assert lpk.take(wa.b64url_decode(first[0])) is None  # the oldest went first
    assert lpk.take(wa.b64url_decode(first[-1])) is not None
    lpk.passwordless_options(px.db, "198.51.100.8")  # another address is unaffected
    assert lpk.live_challenges("passwordless") == lpk.PASSWORDLESS_PER_ADDRESS  # (2 left of .7) + 1 of .8
    # through the route: the caller's address bucket is what counts
    c = px.remote(**_net(31))
    for _ in range(6):
        assert c.post(PL_OPTS).status_code == 200
    assert sum(1 for ch in lpk.all_challenges() if ch.purpose == "passwordless" and ch.bind == hua.limit_ip("203.0.113.31")) == lpk.PASSWORDLESS_PER_ADDRESS


def test_f1_the_bound_pools_keep_their_ceiling(px, monkeypatch):
    px.configure()
    monkeypatch.setattr(lpk, "MAX_CHALLENGES", 1)
    _ca, ca = px.ready("anna")
    _cb, cb = px.ready("boris")
    assert ca.post(REG_OPTS).status_code == 200
    r = cb.post(REG_OPTS)
    assert r.status_code == 429 and r.json()["code"] == "rate_limited"


def test_f10_passwordless_options_have_their_own_per_address_budget(px):
    px.configure(first=True)
    _uid, _c, _auth = _with_passkey(px)
    c2, _ = px.pending("maria", **_net(44))
    codes = [c2.post(PL_OPTS).status_code for _ in range(31)]
    assert codes[:30] == [200] * 30 and codes[30] == 429
    assert c2.post(SF_OPTS).status_code == 200  # the second-step options from the same address are untouched


def _remote_admin(px: Px):
    px.flag("u-owner")
    px.bind("u-owner", "system_admin")
    assert px.login(px.owner).status_code == 200
    return px.client


@pytest.mark.parametrize("key, value", [
    ("security.local_passkey_first", "on"),
    ("security.local_passkey_android", "com.smplwise.arx.app:" + ":".join(["AB"] * 32)),
    ("security.local_public_url", "https://elsewhere.example.net"),
])
def test_f4_the_sign_in_shaping_settings_change_only_from_the_local_channel(px, key, value):
    px.configure()
    remote_admin = _remote_admin(px)
    before = px.admin.get("/api/v1/settings").json()["settings"][key]
    r = remote_admin.patch("/arx/api/v1/settings", json={key: value})
    assert r.status_code == 403 and r.json()["code"] == "local_only" and r.json()["details"]["field"] == key, r.text
    assert px.admin.get("/api/v1/settings").json()["settings"][key] == before
    assert px.audit("identity.local.setting_local_only")[-1]["reason"] == "remote_channel"
    # repeating the current value through the tunnel is no change and passes; the local channel changes it
    assert remote_admin.patch("/arx/api/v1/settings", json={key: before}).status_code == 200
    assert px.admin.patch("/api/v1/settings", json={key: value}).status_code == 200


def test_f4_a_remote_patch_with_one_local_only_key_writes_nothing(px):
    px.configure()
    remote_admin = _remote_admin(px)
    r = remote_admin.patch("/arx/api/v1/settings", json={"security.local_passkey_first": "on", "security.local_link_ttl_h": 24})
    assert r.status_code == 403
    s = px.admin.get("/api/v1/settings").json()["settings"]
    assert s["security.local_passkey_first"] == "off" and str(s["security.local_link_ttl_h"]) != "24"


def test_f5_an_assertion_for_the_old_address_is_refused_after_a_change(px):
    px.configure(first=True)
    _uid, c, auth = _with_passkey(px)
    assert c.put("/arx/api/v1/auth/passkeys/first", json={"on": True}).status_code == 200
    c2, _ = px.pending("maria")
    sf_opts = c2.post(SF_OPTS).json()
    c3 = px.remote()
    pl_opts = c3.post(PL_OPTS).json()
    assert px.admin.patch("/api/v1/settings", json={"security.local_public_url": "https://other.example.com"}).status_code == 200
    assert c2.post(SF, json={"credential": auth.get(sf_opts)}).status_code == 401
    assert px.audit("auth.local.passkey.refused")[-1]["reason"] == "rp_changed"
    assert c3.post(PL, json={"credential": auth.get(pl_opts)}).status_code == 401
    assert px.audit("auth.local.passkey.refused")[-1]["reason"] == "rp_changed"


@pytest.mark.parametrize("value", ["YW=Jj", "YWJj=", "YWI==", "YWJ", "Y", "=", "YWI=x"])
def test_f6_base64url_is_strict(value):
    with pytest.raises(wa.WebAuthnError):
        wa.b64url_decode(value)


def test_f6_base64url_accepts_the_canonical_spellings():
    assert wa.b64url_decode("YWJj") == b"abc" and wa.b64url_decode("YWI") == b"ab" and wa.b64url_decode("YWI=") == b"ab"


def test_f7_a_changed_backup_eligibility_is_refused(px):
    px.configure()
    _uid, _c, auth = _with_passkey(px)  # registered BE = 0
    auth.be = True
    c2, _ = px.pending("maria")
    r = c2.post(SF, json={"credential": auth.get(c2.post(SF_OPTS).json())})
    assert r.status_code == 401 and px.audit("auth.local.passkey.refused")[-1]["reason"] == "backup_eligibility_changed"
    auth.be = False
    assert c2.post(SF, json={"credential": auth.get(c2.post(SF_OPTS).json())}).status_code == 200


# ---------------------------------------------------------------- 7. the verifier itself (services/webauthn.py)

def test_rs256_credential_registers_and_signs_in(px):
    px.configure()
    _uid, _c, auth = _with_passkey(px, alg=-257)
    assert px.rows("SELECT alg FROM auth_webauthn_credentials") == [{"alg": -257}]
    c2, _ = px.pending("maria")
    assert c2.post(SF, json={"credential": auth.get(c2.post(SF_OPTS).json())}).status_code == 200


@pytest.mark.parametrize("raw, reason", [
    (b"\xc1\x00", "cbor_unsupported"),            # a tag
    (b"\x9f\x01\xff", "cbor_unsupported"),        # an indefinite-length array
    (b"\xf9\x3c\x00", "cbor_unsupported"),        # a half float
    (b"\xa2\x01\x01\x01\x02", "cbor_duplicate_key"),
    (b"\x01\x02", "cbor_trailing"),
    (b"\x5a\xff\xff\xff\xff", "cbor_truncated"),  # a byte string longer than the input
    (b"\xa1\xf5\x01", "cbor_bad_key"),
    (b"\x81" * 20 + b"\x01", "cbor_too_deep"),
])
def test_cbor_subset_refuses_everything_outside_it(raw, reason):
    with pytest.raises(wa.WebAuthnError) as exc:
        wa.cbor_decode(raw)
    assert exc.value.reason == reason


def test_cose_and_auth_data_refusals():
    from cryptography.hazmat.primitives.asymmetric import rsa

    with pytest.raises(wa.WebAuthnError) as exc:
        wa.load_cose_key(cbor({1: 1, 3: -8, -1: 6, -2: b"\x00" * 32}))  # EdDSA: not offered, not accepted
    assert exc.value.reason == "unsupported_algorithm"
    small = rsa.generate_private_key(public_exponent=65537, key_size=1024).public_key().public_numbers()
    with pytest.raises(wa.WebAuthnError):
        wa.load_cose_key(cbor({1: 3, 3: -257, -1: small.n.to_bytes(128, "big"), -2: b"\x01\x00\x01"}))
    with pytest.raises(wa.WebAuthnError):  # a point that is not on P-256
        wa.load_cose_key(cbor({1: 2, 3: -7, -1: 1, -2: b"\x01" * 32, -3: b"\x02" * 32}))
    base = b"\x00" * 32
    with pytest.raises(wa.WebAuthnError):
        wa.parse_auth_data(base + bytes([0x11]) + b"\x00\x00\x00\x01")  # BS without BE
    with pytest.raises(wa.WebAuthnError):
        wa.parse_auth_data(base + bytes([0x01]) + b"\x00\x00\x00\x01" + b"junk")  # trailing bytes
    with pytest.raises(wa.WebAuthnError):
        wa.check_client_data(json.dumps({"type": "webauthn.get", "challenge": b64u(b"x" * 32), "origin": PUBLIC, "crossOrigin": True}).encode(),
                             kind="webauthn.get", challenge=b"x" * 32, origin=PUBLIC)
    with pytest.raises(wa.WebAuthnError):
        wa.check_client_data(json.dumps({"type": "webauthn.get", "challenge": b64u(b"x" * 32), "origin": PUBLIC, "topOrigin": PUBLIC}).encode(),
                             kind="webauthn.get", challenge=b"x" * 32, origin=PUBLIC)
    assert wa.b64url_decode(base64.urlsafe_b64encode(b"ok").decode()) == b"ok"
    with pytest.raises(wa.WebAuthnError):
        wa.b64url_decode("not base64!")
