"""MFA-PASSKEYS-2490 (second-factor train, slice 4; owner decision Q50 "passkeys for all users"): passkeys for every user who signs in to
Arx, the passkey as a step-up method, and the step-up challenge (services/user_passkeys.py, routers/local_passkeys.py,
routers/second_factor.step_up_verify).

A software authenticator (tests/webauthn_fake.py) stands in for a real device. Covered: the all-users switch (default on, off = the 403
of before and the passkeys do not count), a Home Assistant user adds / renames / removes a passkey, the first passkey behaves like a
TOTP enrolment, a passkey-only user is now gated and passes with a passkey, the challenge is bound to the user, the session and the
action, expires, is single use and must be named by its id, a bad signature / a wrong origin / a counter regression are refused and
audited, adding a second passkey and removing one need a fresh proof (also while step-up is off), the last factor's removal drops the
proofs, the 0-minute mode, an Arx-only identity keeps its rules and can use the passkey for step-up too, the Ingress channel, the
settings plumbing, and that no audit row carries a credential id, a challenge, a signature or a label."""
from __future__ import annotations

import json
import time
import types

from fastapi.testclient import TestClient

from smplwise.services import local_passkeys as lpk
from smplwise.services import step_up
from smplwise.services import user_passkeys as upk
from test_mfa_stepup_2490 import Clock, clock, stored, title  # noqa: F401 - `clock` is a fixture
from test_local_passkeys import _with_passkey, px  # noqa: F401 - `px` is the fixture of the Arx-only identities
from test_second_factor import HEADER, arx, bump_step, code_now, enrol, fresh_login  # noqa: F401 - `arx` is the fixture
from webauthn_fake import FakeAuthenticator, b64u

PUBLIC = "https://arx.example.com"
PK = "/arx/api/v1/auth/passkeys"
REG_OPTS = PK + "/register/options"
REG = PK + "/register"
CHALLENGE = "/arx/api/v1/auth/step-up/challenge"
VERIFY = "/arx/api/v1/auth/step-up/verify"
STATUS = "/arx/api/v1/auth/step-up"


def configure(arx, **extra) -> TestClient:
    """The public address (the RP id) is set from the local channel by the system administrator (dev-joni)."""
    local = TestClient(arx.app)
    r = local.patch("/api/v1/settings", json={"security.local_public_url": PUBLIC, **extra})
    assert r.status_code == 200, r.text
    return local


def add_passkey(arx, user, auth: FakeAuthenticator | None = None, *, login: bool = True, label: str = "laptop"):
    if login:
        assert fresh_login(arx, user).status_code == 200
    auth = auth or FakeAuthenticator()
    opts = arx.client.post(REG_OPTS)
    assert opts.status_code == 200, opts.text
    r = arx.client.post(REG, json={"credential": auth.create(opts.json()), "label": label})
    assert r.status_code == 201, r.text
    return auth, r.json()


def challenge(arx, action: str | None = "system.configure") -> dict:
    r = arx.client.post(CHALLENGE, json={"action": action} if action else {})
    assert r.status_code == 200, r.text
    return r.json()


def answer(arx, auth: FakeAuthenticator, ch: dict, *, action: str | None = "system.configure", challenge_id: str | None = None, **get_kw):
    body = {"method": "passkey", "challenge_id": challenge_id or ch["challenge_id"], "assertion": auth.get(ch["webauthn"], **get_kw)}
    if action:
        body["action"] = action
    return arx.client.post(VERIFY, json=body)


def passkey_step_up(arx, auth: FakeAuthenticator, action: str = "system.configure"):
    return answer(arx, auth, challenge(arx, action), action=action)


def details(row: dict) -> dict:
    """The audit row's details without the channel the audit layer adds by itself."""
    out = json.loads(row["details_json"] or "{}")
    out.pop("channel", None)
    return out


# ---------------------------------------------------------------- the switch and the settings

def test_the_switch_defaults_on_is_never_restored_and_only_a_system_administrator_changes_it(arx):
    from smplwise.services import backup
    from smplwise.services.settings_store import DEFAULTS

    assert DEFAULTS["security.passkeys_all_users"] == "on"
    assert "security.passkeys_all_users" in backup.SETTINGS_KEEP
    local = configure(arx)
    assert local.get("/api/v1/settings").json()["settings"]["security.passkeys_all_users"] == "on"
    assert local.patch("/api/v1/settings", json={"security.passkeys_all_users": "maybe"}).status_code == 422
    r = local.patch("/api/v1/settings", json={"security.passkeys_all_users": "off"})
    assert r.status_code == 200, r.text
    row = arx.audit("security.passkeys_all_users")[-1]
    assert row["decision"] == "allowed" and details(row) == {"to": "off"}


def test_an_ha_user_adds_a_passkey_from_my_account_and_it_counts(arx):
    configure(arx)
    _auth, out = add_passkey(arx, arx.viewer)
    assert out["first_factor"] is True and out["passkey"]["usable"] is True and "credential_id" not in out["passkey"]
    own = arx.client.get(PK).json()
    assert own["user_kind"] == "user" and own["available"] is True and own["rp_id"] == "arx.example.com"
    assert (own["first_allowed"], own["first_on"], own["only_on"], own["only_effective"]) == (False, False, False, False)
    assert len(own["credentials"]) == 1 and own["credentials"][0]["label"] == "laptop" and own["totp"] is False
    assert own["recent_auth"] is True  # the first passkey counts as the factor shown in this session (like a TOTP enrolment)
    st = arx.client.get(STATUS).json()
    assert st["methods"] == ["passkey"] and st["applies"] is True
    reg = arx.audit("auth.passkey.registered")[-1]
    assert reg["actor_user_id"] == "u-viewer" and details(reg)["first_factor"] is True and details(reg)["passkey"] == out["passkey"]["id"]


def test_with_the_switch_off_an_ha_user_gets_the_answer_of_before_and_the_passkey_does_not_count(arx):
    local = configure(arx)
    add_passkey(arx, arx.viewer)
    assert local.patch("/api/v1/settings", json={"security.passkeys_all_users": "off"}).status_code == 200
    r = arx.client.get(PK)
    assert r.status_code == 403 and r.json()["code"] == "not_local_identity"
    assert arx.client.post(REG_OPTS).status_code == 403
    st = arx.client.get(STATUS).json()
    assert st["methods"] == [] and st["reason"] == "no_method"  # kept, listed nowhere, never a factor
    assert arx.client.post(CHALLENGE, json={"action": "system.configure"}).json()["code"] == "step_up_no_method"
    with arx.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM auth_webauthn_credentials WHERE user_id = 'u-viewer'").fetchone()[0] == 1


def test_no_public_address_no_passkeys(arx):
    assert fresh_login(arx, arx.viewer).status_code == 200
    own = arx.client.get(PK).json()
    assert own["available"] is False and own["credentials"] == []
    r = arx.client.post(REG_OPTS)
    assert r.status_code == 409 and r.json()["code"] == "passkey_unavailable"


# ---------------------------------------------------------------- passkey-only users are gated now, and pass with the passkey

def test_a_passkey_only_administrator_is_gated_and_passes_with_the_passkey(arx, clock):
    configure(arx)
    auth, _ = add_passkey(arx, arx.owner)
    assert title(arx, "first").status_code == 200  # the enrolment's own proof (5 minutes)
    clock.advance(6)
    r = title(arx, "Lobby")
    assert r.status_code == 403 and r.json()["code"] == "step_up_required" and r.json()["details"]["methods"] == ["passkey"]
    ch = challenge(arx)
    assert ch["action"] == "system.configure" and ch["expires_in"] == 60 and ch["challenge_id"].startswith("suc_")
    opts = ch["webauthn"]["publicKey"]
    assert opts["rpId"] == "arx.example.com" and opts["userVerification"] == "required" and len(opts["allowCredentials"]) == 1
    v = answer(arx, auth, ch)
    assert v.status_code == 200, v.text
    assert v.json()["method"] == "passkey" and v.json()["minutes"] == 5 and v.json()["valid_until"]
    assert title(arx, "Lobby").status_code == 200 and stored(arx, "home.title") == "Lobby"
    ok = arx.audit("auth.step_up.ok")[-1]
    assert details(ok)["method"] == "passkey" and details(ok)["action"] == "system.configure" and details(ok)["passkey"].startswith("pk_")
    assert details(arx.audit("auth.step_up.challenge")[-1]) == {"method": "passkey", "action": "system.configure"}


def test_a_user_with_both_methods_gets_both(arx, clock):
    configure(arx)
    enrol(arx, arx.owner)
    clock.advance(6)
    r = arx.client.post(REG_OPTS)  # adding a passkey to an account that has a factor needs a fresh proof
    assert r.status_code == 403 and r.json()["code"] == "step_up_required"
    assert r.json()["details"]["action"] == upk.ACTION_REGISTER and r.json()["details"]["challenge_path"] == "auth/step-up/challenge"
    bump_step(arx, "u-owner")
    assert arx.client.post(VERIFY, json={"method": "totp", "code": code_now(arx, "u-owner"), "action": upk.ACTION_REGISTER}).status_code == 200
    add_passkey(arx, arx.owner, login=False)
    assert arx.client.get(STATUS).json()["methods"] == ["totp", "passkey"]


# ---------------------------------------------------------------- the challenge: bound, short, single use

def test_a_challenge_is_single_use(arx, clock):
    configure(arx)
    auth, _ = add_passkey(arx, arx.owner)
    ch = challenge(arx)
    first = answer(arx, auth, ch)
    assert first.status_code == 200
    again = answer(arx, auth, ch)  # the same challenge once more (a replay)
    assert again.status_code == 400 and again.json()["code"] == "step_up_failed"
    assert arx.audit("auth.step_up.failed")[-1]["reason"] == "passkey_challenge_unknown"


def test_a_challenge_is_bound_to_its_action(arx, clock):
    configure(arx)
    auth, _ = add_passkey(arx, arx.owner)
    ch = challenge(arx, "system.configure")
    r = answer(arx, auth, ch, action="rbac.assign")
    assert r.status_code == 400 and arx.audit("auth.step_up.failed")[-1]["reason"] == "passkey_challenge_mismatch"


def test_a_challenge_must_be_named_by_its_id(arx, clock):
    configure(arx)
    auth, _ = add_passkey(arx, arx.owner)
    r = answer(arx, auth, challenge(arx), challenge_id="suc_000000000000000000000000")
    assert r.status_code == 400 and arx.audit("auth.step_up.failed")[-1]["reason"] == "passkey_challenge_mismatch"


def test_a_challenge_expires_after_sixty_seconds(arx, clock, monkeypatch):
    configure(arx)
    auth, _ = add_passkey(arx, arx.owner)
    ch = challenge(arx)
    later = time.time() + lpk.CHALLENGE_TTL_S + 1
    monkeypatch.setattr(lpk, "time", types.SimpleNamespace(time=lambda: later))
    r = answer(arx, auth, ch)
    assert r.status_code == 400 and arx.audit("auth.step_up.failed")[-1]["reason"] == "passkey_challenge_unknown"


def test_a_challenge_is_bound_to_its_session(arx, clock):
    configure(arx)
    auth, _ = add_passkey(arx, arx.owner)
    ch = challenge(arx)
    assert fresh_login(arx, arx.owner).status_code == 200  # another sign-in of the same user
    r = answer(arx, auth, ch)
    assert r.status_code == 400 and arx.audit("auth.step_up.failed")[-1]["reason"] == "passkey_challenge_mismatch"


def test_a_challenge_is_bound_to_its_user(arx, clock):
    configure(arx)
    arx.flag("u-viewer")
    arx.bind("u-viewer", "viewer")
    viewer_auth, _ = add_passkey(arx, arx.viewer)
    viewers = challenge(arx)
    add_passkey(arx, arx.owner)  # signs the owner in on the same browser
    r = answer(arx, viewer_auth, viewers)  # the viewer's challenge and assertion, presented by the owner's session
    assert r.status_code == 400
    row = arx.audit("auth.step_up.failed")[-1]
    assert row["actor_user_id"] == "u-owner" and row["reason"] == "passkey_cross_user"


def test_a_bad_signature_a_wrong_origin_and_a_counter_regression_are_refused(arx, clock):
    configure(arx)
    auth, _ = add_passkey(arx, arx.owner)
    assert answer(arx, auth, challenge(arx), tamper=True).status_code == 400
    assert answer(arx, auth, challenge(arx), origin="https://evil.example.com").status_code == 400
    assert answer(arx, auth, challenge(arx), rp_id="evil.example.com").status_code == 400
    assert answer(arx, auth, challenge(arx)).status_code == 200  # the counter moves on
    r = answer(arx, auth, challenge(arx), counter=auth.counter)  # a clone repeats a counter already seen
    assert r.status_code == 400
    reasons = [x["reason"] for x in arx.audit("auth.step_up.failed")]
    assert reasons[:3] == ["passkey_bad_signature", "passkey_wrong_origin", "passkey_wrong_rp_id"], reasons
    assert reasons[-1] == "passkey_counter_regression"
    clone = arx.audit("auth.passkey.counter_regression")[-1]
    assert clone["decision"] == "denied" and details(clone)["step"] == "step_up"


def test_an_administrator_must_verify_the_user(arx, clock):
    configure(arx)
    auth, _ = add_passkey(arx, arx.owner)
    r = answer(arx, auth, challenge(arx), uv=False)
    assert r.status_code == 400 and arx.audit("auth.step_up.failed")[-1]["reason"] == "passkey_no_user_verification"


def test_no_session_no_method_and_the_validation(arx, clock):
    configure(arx)
    arx.flag("u-viewer")
    assert fresh_login(arx, arx.viewer).status_code == 200
    r = arx.client.post(CHALLENGE, json={"action": "system.configure"})
    assert r.status_code == 409 and r.json()["code"] == "step_up_no_method"
    assert arx.client.post(VERIFY, json={"method": "passkey", "challenge_id": "x", "assertion": {}}).json()["code"] == "step_up_no_method"
    add_passkey(arx, arx.viewer, login=False)
    assert arx.client.post(VERIFY, json={"method": "passkey", "action": upk.ACTION_REMOVE}).status_code == 422
    assert arx.client.post(VERIFY, json={"method": "totp"}).status_code == 422
    assert arx.client.post(CHALLENGE, json={"action": "Bad Action"}).status_code == 422


# ---------------------------------------------------------------- the factor changes need a proof, also while step-up is off

def test_removing_a_passkey_needs_a_proof_and_the_last_one_drops_the_proofs(arx, clock):
    configure(arx)
    arx.flag("u-viewer")
    auth, out = add_passkey(arx, arx.viewer)
    pk = out["passkey"]["id"]
    clock.advance(6)
    r = arx.client.delete(f"{PK}/{pk}")
    assert r.status_code == 403 and r.json()["code"] == "step_up_required" and r.json()["details"]["action"] == upk.ACTION_REMOVE
    assert passkey_step_up(arx, auth, upk.ACTION_REMOVE).status_code == 200
    r = arx.client.delete(f"{PK}/{pk}")
    assert r.status_code == 200, r.text
    assert r.json()["removed"] == pk and r.json()["factor_cleared"] is True and r.json()["credentials"] == []
    st = arx.client.get(STATUS).json()
    assert st["methods"] == [] and st["valid_until"] is None  # no proof outlives the last factor
    row = arx.audit("auth.passkey.removed")[-1]
    assert details(row) == {"passkey": pk, "by": "self", "proof": "step_up", "factor_left": False}
    assert arx.client.delete(f"{PK}/pk_nope").status_code == 404


def test_the_authenticator_code_in_the_request_also_removes_a_passkey(arx, clock):
    configure(arx)
    enrol(arx, arx.viewer)
    bump_step(arx, "u-viewer")
    assert arx.client.post(VERIFY, json={"method": "totp", "code": code_now(arx, "u-viewer"), "action": upk.ACTION_REGISTER}).status_code == 200
    _auth, out = add_passkey(arx, arx.viewer, login=False)
    clock.advance(6)
    bump_step(arx, "u-viewer")
    r = arx.client.delete(f"{PK}/{out['passkey']['id']}", headers={HEADER: code_now(arx, "u-viewer")})
    assert r.status_code == 200, r.text
    assert r.json()["factor_cleared"] is False  # the code stays
    assert details(arx.audit("auth.passkey.removed")[-1])["proof"] == "code"


def test_factor_changes_still_need_a_proof_while_step_up_is_off(arx, clock):
    local = configure(arx)
    auth, _ = add_passkey(arx, arx.owner)
    assert local.patch("/api/v1/settings", json={"security.step_up": "off"}).status_code == 200
    clock.advance(6)
    assert title(arx, "free").status_code == 200  # the switch is off: no step-up for settings
    r = arx.client.post(REG_OPTS)
    assert r.status_code == 403 and r.json()["code"] == "step_up_required"
    # a proof for an ordinary action is "not applicable" while the switch is off; for the factor change it is accepted
    assert passkey_step_up(arx, auth, "system.configure").json()["code"] == "step_up_not_applicable"
    assert passkey_step_up(arx, auth, upk.ACTION_REGISTER).status_code == 200
    add_passkey(arx, arx.owner, FakeAuthenticator(), login=False, label="phone")
    assert len(arx.client.get(PK).json()["credentials"]) == 2


def test_the_authenticator_code_proves_a_factor_change_while_step_up_is_off(arx, clock):
    local = configure(arx)
    enrol(arx, arx.owner)
    assert local.patch("/api/v1/settings", json={"security.step_up": "off"}).status_code == 200
    clock.advance(6)
    assert arx.client.post(REG_OPTS).json()["code"] == "step_up_required"
    bump_step(arx, "u-owner")
    r = arx.client.post(VERIFY, json={"method": "totp", "code": code_now(arx, "u-owner"), "action": upk.ACTION_REGISTER})
    assert r.status_code == 200, r.text
    assert arx.client.post(REG_OPTS).status_code == 200
    bump_step(arx, "u-owner")  # an ordinary action stays "not applicable" while the switch is off
    assert arx.client.post(VERIFY, json={"method": "totp", "code": code_now(arx, "u-owner"), "action": "system.configure"}).json()["code"] == "step_up_not_applicable"


def test_zero_minutes_a_passkey_proof_is_good_for_one_change(arx, clock):
    configure(arx)
    auth, _ = add_passkey(arx, arx.owner)
    arx.setting("security.step_up_minutes", "0")
    clock.advance(6)
    assert passkey_step_up(arx, auth).json()["minutes"] == 0
    assert title(arx, "one").status_code == 200
    assert title(arx, "two").status_code == 403


def test_renaming_is_audited_without_the_label(arx):
    configure(arx)
    _auth, out = add_passkey(arx, arx.viewer)
    pk = out["passkey"]["id"]
    r = arx.client.patch(f"{PK}/{pk}", json={"label": "work phone"})
    assert r.status_code == 200 and r.json()["credentials"][0]["label"] == "work phone"
    assert details(arx.audit("auth.passkey.renamed")[-1]) == {"passkey": pk}
    assert arx.client.patch(f"{PK}/{pk}", json={"label": "bad\x07"}).status_code == 422


def test_a_registration_challenge_is_bound_to_its_session(arx):
    configure(arx)
    assert fresh_login(arx, arx.viewer).status_code == 200
    opts = arx.client.post(REG_OPTS).json()
    assert fresh_login(arx, arx.viewer).status_code == 200  # another sign-in
    r = arx.client.post(REG, json={"credential": FakeAuthenticator().create(opts)})
    assert r.status_code == 400 and r.json()["code"] == "passkey_invalid"
    assert arx.audit("auth.passkey.refused")[-1]["reason"] == "challenge_mismatch"


# ---------------------------------------------------------------- the Ingress channel, hygiene

def test_ingress_users_have_passkeys_too(arx):
    local = configure(arx)
    own = local.get("/api/v1/auth/passkeys")
    assert own.status_code == 200 and own.json()["user_kind"] == "user"
    opts = local.post("/api/v1/auth/passkeys/register/options")
    assert opts.status_code == 200 and opts.json()["publicKey"]["rp"]["id"] == "arx.example.com"
    auth = FakeAuthenticator()
    r = local.post("/api/v1/auth/passkeys/register", json={"credential": auth.create(opts.json())})
    assert r.status_code == 201, r.text


def test_no_audit_row_carries_a_credential_id_a_challenge_a_signature_or_a_label(arx, clock):
    configure(arx)
    auth, out = add_passkey(arx, arx.owner, label="secret-label")
    ch = challenge(arx)
    assert answer(arx, auth, ch).status_code == 200
    answer(arx, auth, ch)  # a refused replay too
    with arx.db.connection(mode="read") as conn:
        rows = [dict(r) for r in conn.execute("SELECT * FROM audit_log").fetchall()]
    blob = json.dumps(rows, ensure_ascii=False)
    assert b64u(auth.credential_id) not in blob and ch["webauthn"]["publicKey"]["challenge"] not in blob
    assert "secret-label" not in blob and ch["challenge_id"] not in blob


def test_the_unit_rules(arx):
    configure(arx)
    add_passkey(arx, arx.viewer)
    with arx.db.connection(mode="read") as conn:
        assert upk.counts(conn, "u-viewer") and upk.has_factor(conn, "u-viewer") and not upk.is_local_user(conn, "u-viewer")
        assert step_up.methods_of(conn, "u-viewer") == ["passkey"]
    assert upk.challenge_id(b"a") != upk.challenge_id(b"b") and upk.challenge_id(b"a").startswith("suc_")
    assert upk._bind("remote:x", "a") != upk._bind("remote:y", "a") != upk._bind("remote:x", "b")
    assert "remote:x" not in upk._bind("remote:x", "a")


# ---------------------------------------------------------------- Arx-only identities keep their rules

def test_an_arx_only_identity_keeps_its_rules_and_steps_up_with_its_passkey(px):
    px.configure()
    uid, c, auth = _with_passkey(px)
    own = c.get(PK).json()
    assert own["user_kind"] == "local" and own["recent_auth"] is True
    assert "passkey" in c.get(STATUS).json()["methods"]  # a passkey-only local user is gated now
    pk = own["credentials"][0]["id"]
    px.age_sessions(uid)  # the fresh sign-in is over: removal needs a proof
    r = c.delete(f"{PK}/{pk}")
    assert r.status_code == 403 and r.json()["code"] == "reauth_required"  # the answer of before
    ch = c.post(CHALLENGE, json={"action": upk.ACTION_REMOVE}).json()
    v = c.post(VERIFY, json={"method": "passkey", "challenge_id": ch["challenge_id"], "assertion": auth.get(ch["webauthn"]), "action": upk.ACTION_REMOVE})
    assert v.status_code == 200, v.text
    r = c.delete(f"{PK}/{pk}")  # the step-up proof now counts as the fresh proof
    assert r.status_code == 200, r.text
    assert px.audit("auth.local.passkey.removed")
