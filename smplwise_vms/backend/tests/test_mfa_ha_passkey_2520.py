"""MFA-HA-PASSKEY-2520: the passkey as the remote sign-in factor of a home-system user (services/passkey_sign_in.py, the browser exchange
of services/ha_user_auth.py), behind the owner's switch `security.passkey_remote_factor` (default off = the behaviour of before).

A software authenticator (tests/webauthn_fake.py) stands in for a real device; the fake Home Assistant core of test_remote_access.py
issues the tokens. Covered: the switch (default off, validated, never restored, audited), off = nothing asked of a passkey-only user and
the 401 of a code user carries no offer (byte-identical details), on = a passkey-only user is asked and passes with the passkey, a code
user may answer with either, the offer is bound to the user and to the Home Assistant sign-in, single use, the origin / RP id / signature /
user handle / counter checks, a cross-user credential, the sign-in factor policy is satisfied, the bearer path is unchanged and refuses a
passkey answer, the compliance view counts the passkey, the step-up proof of a passkey sign-in, and audit hygiene."""
from __future__ import annotations

import itertools
import json

from fastapi.testclient import TestClient

from smplwise.services import passkey_sign_in as psi
from test_mfa_passkeys_2490 import PUBLIC, add_passkey, configure, details
from test_second_factor import HEADER, arx, code_now, enrol  # noqa: F401 - `arx` is the fixture
from test_second_factor_followups import ME, b, bearer_app, put
from webauthn_fake import b64u

SESSION = "/arx/api/v1/auth/session"
KEY = "security.passkey_remote_factor"
_ips = itertools.count(10)


def sign_in(arx, token: str, answer: str | None = None):
    """One exchange with a FIXED Home Assistant token (the page retries with the same token), from its own documentation address so
    the exchange's per-address limit never decides a test."""
    arx.client.cookies.clear()
    headers = {"Authorization": f"Bearer {token}", "CF-Connecting-IP": f"198.51.100.{next(_ips) % 250 + 1}"}
    if answer is not None:
        headers[HEADER] = answer
    return arx.client.post(SESSION, headers=headers)


def pk_answer(assertion: dict) -> str:
    r = assertion["response"]
    parts = [assertion["rawId"], r["clientDataJSON"], r["authenticatorData"], r["signature"]] + ([r["userHandle"]] if r.get("userHandle") else [])
    return "pk1:" + ".".join(parts)


def offer_of(r) -> dict:
    assert r.status_code == 401 and r.json()["code"] == "second_factor_required", r.text
    return r.json()["details"]


def switch(arx, value: str = "on") -> None:
    arx.setting(KEY, value)


# ---------------------------------------------------------------- the switch

def test_the_switch_defaults_off_validates_is_never_restored_and_is_audited(arx):
    from smplwise.services import backup
    from smplwise.services.settings_store import DEFAULTS

    assert DEFAULTS[KEY] == "off" and KEY in backup.SETTINGS_KEEP
    local = configure(arx)
    assert local.get("/api/v1/settings").json()["settings"][KEY] == "off"
    assert local.patch("/api/v1/settings", json={KEY: "maybe"}).status_code == 422
    r = local.patch("/api/v1/settings", json={KEY: "on"})
    assert r.status_code == 200, r.text
    assert any(details(row).get(KEY) == "on" for row in arx.audit("settings.update"))


def test_off_a_passkey_only_user_signs_in_as_before_and_a_code_user_gets_no_offer(arx):
    configure(arx)
    add_passkey(arx, arx.viewer)
    r = sign_in(arx, arx.token(arx.viewer))
    assert r.status_code == 200, r.text  # the behaviour of before: the passkey is a step-up method only
    enrol(arx, arx.owner)
    add_passkey(arx, arx.owner, login=False)  # the code user's own passkey (step-up is on: the enrolment's proof covers it)
    r = sign_in(arx, arx.token(arx.owner))
    assert r.status_code == 401 and r.json()["code"] == "second_factor_required" and r.json()["details"] == {}
    # a passkey answer is refused while the switch is off (fail closed), audited without the answer
    r = sign_in(arx, arx.token(arx.owner), "pk1:a.b.c.d")
    assert r.status_code == 401 and r.json()["code"] == "second_factor_invalid"
    row = arx.audit("auth.second_factor.failed")[-1]
    assert details(row)["method"] == "passkey" and details(row)["why"] == "passkey_not_counting" and "pk1" not in row["details_json"]


# ---------------------------------------------------------------- on: the passkey is the sign-in factor

def test_on_a_passkey_only_user_is_asked_and_passes_with_the_passkey(arx):
    configure(arx)
    auth, out = add_passkey(arx, arx.viewer)
    switch(arx)
    token = arx.token(arx.viewer)
    offer = offer_of(sign_in(arx, token))
    assert offer["methods"] == ["passkey"] and offer["passkey"]["origin"] == PUBLIC
    pk = offer["passkey"]["publicKey"]
    assert pk["rpId"] == "arx.example.com" and pk["userVerification"] == "preferred" and len(pk["allowCredentials"]) == 1
    r = sign_in(arx, token, pk_answer(auth.get(offer["passkey"])))
    assert r.status_code == 200, r.text
    assert r.json()["user"]["id"] == "u-viewer"
    used = arx.audit("auth.passkey.used")[-1]
    assert used["actor_user_id"] == "u-viewer" and details(used) == {"step": "sign_in", "passkey": out["passkey"]["id"]}
    # the session starts with a fresh step-up proof, as after the code
    st = arx.client.get("/arx/api/v1/auth/step-up").json()
    assert st["methods"] == ["passkey"] and st.get("valid_until")


def test_on_a_code_user_with_a_passkey_may_answer_with_either(arx):
    configure(arx)
    enrol(arx, arx.owner)
    auth, _ = add_passkey(arx, arx.owner, login=False)
    switch(arx)
    token = arx.token(arx.owner)
    offer = offer_of(sign_in(arx, token))
    assert offer["methods"] == ["totp", "passkey"] and offer["passkey"]["publicKey"]["userVerification"] == "required"  # an administrator
    assert sign_in(arx, token, pk_answer(auth.get(offer["passkey"]))).status_code == 200
    token2 = arx.token(arx.owner)
    assert sign_in(arx, token2, code_now(arx, "u-owner", offset=1)).status_code == 200  # the code still works


def test_the_offer_is_bound_to_the_home_assistant_sign_in_single_use_and_checked(arx):
    configure(arx)
    auth, _ = add_passkey(arx, arx.viewer)
    switch(arx)
    token = arx.token(arx.viewer)
    offer = offer_of(sign_in(arx, token))
    good = auth.get(offer["passkey"])
    # the same assertion with another sign-in of the same user (another refresh token): refused, and the challenge is spent
    other = arx.token(arx.viewer)
    r = sign_in(arx, other, pk_answer(good))
    assert r.status_code == 401 and r.json()["code"] == "second_factor_invalid"
    assert details(arx.audit("auth.second_factor.failed")[-1])["why"] == "passkey_challenge_mismatch"
    r = sign_in(arx, token, pk_answer(good))
    assert r.status_code == 401 and details(arx.audit("auth.second_factor.failed")[-1])["why"] == "passkey_challenge_unknown"

    def refused(**get_kw) -> str:
        o = offer_of(sign_in(arx, token))
        r = sign_in(arx, token, pk_answer(auth.get(o["passkey"], **get_kw)))
        assert r.status_code == 401 and r.json()["code"] == "second_factor_invalid", r.text
        return details(arx.audit("auth.second_factor.failed")[-1])["why"]

    assert refused(rp_id="evil.example.com").startswith("passkey_")
    assert refused(tamper=True).startswith("passkey_")
    assert refused(user_handle=b"x" * 32) == "passkey_user_handle_mismatch"
    assert refused(up=False).startswith("passkey_")
    # a malformed answer
    r = sign_in(arx, token, "pk1:only.three.parts")
    assert r.status_code == 401 and details(arx.audit("auth.second_factor.failed")[-1])["why"] == "passkey_malformed"
    # after all that the right ceremony still passes
    o = offer_of(sign_in(arx, token))
    assert sign_in(arx, token, pk_answer(auth.get(o["passkey"]))).status_code == 200


def test_a_wrong_origin_is_refused_by_the_verifier(arx):
    configure(arx)
    auth, _ = add_passkey(arx, arx.viewer)
    switch(arx)
    token = arx.token(arx.viewer)
    o = offer_of(sign_in(arx, token))
    r = sign_in(arx, token, pk_answer(auth.get(o["passkey"], origin="https://evil.example.com")))
    assert r.status_code == 401 and r.json()["code"] == "second_factor_invalid"
    why = details(arx.audit("auth.second_factor.failed")[-1])["why"]
    assert why.startswith("passkey_") and "origin" in why


def test_another_users_credential_and_a_counter_regression_are_refused(arx):
    configure(arx)
    viewer_auth, _ = add_passkey(arx, arx.viewer)
    owner_auth, _ = add_passkey(arx, arx.owner)
    switch(arx)
    token = arx.token(arx.viewer)
    o = offer_of(sign_in(arx, token))
    r = sign_in(arx, token, pk_answer(owner_auth.get(o["passkey"])))  # the owner's passkey on the viewer's challenge
    assert r.status_code == 401 and details(arx.audit("auth.second_factor.failed")[-1])["why"] == "passkey_cross_user"
    o = offer_of(sign_in(arx, token))
    assert sign_in(arx, token, pk_answer(viewer_auth.get(o["passkey"]))).status_code == 200
    token2 = arx.token(arx.viewer)
    o = offer_of(sign_in(arx, token2))
    r = sign_in(arx, token2, pk_answer(viewer_auth.get(o["passkey"], counter=1)))  # a clone's counter
    assert r.status_code == 401
    assert details(arx.audit("auth.second_factor.failed")[-1])["why"] == "passkey_counter_regression"
    reg = arx.audit("auth.passkey.counter_regression")[-1]
    assert reg["decision"] == "denied" and details(reg)["step"] == "sign_in"


def test_switched_off_again_the_passkey_is_not_asked(arx):
    configure(arx)
    add_passkey(arx, arx.viewer)
    switch(arx)
    assert sign_in(arx, arx.token(arx.viewer)).status_code == 401
    switch(arx, "off")
    assert sign_in(arx, arx.token(arx.viewer)).status_code == 200


# ---------------------------------------------------------------- the sign-in factor policy, the bearer path, the compliance view

def test_a_required_factor_is_satisfied_by_the_passkey_only_while_the_switch_is_on(arx):
    configure(arx)
    auth, _ = add_passkey(arx, arx.owner)
    assert put(arx, "user", "u-owner", "required").status_code == 200
    r = sign_in(arx, arx.token(arx.owner))
    assert r.status_code == 403 and r.json()["code"] == "second_factor_enrollment_required"  # off: the answer of before
    switch(arx)
    token = arx.token(arx.owner)
    o = offer_of(sign_in(arx, token))
    assert sign_in(arx, token, pk_answer(auth.get(o["passkey"]))).status_code == 200


def test_the_bearer_path_is_unchanged_and_refuses_a_passkey_answer(arx):
    configure(arx)
    add_passkey(arx, arx.viewer)
    switch(arx)
    r = bearer_app("203.0.113.40", arx).get(ME, headers=b(arx.token(arx.viewer)))
    assert r.status_code == 200, r.text  # a native client: the passkey is not a sign-in factor there (as before)
    enrol(arx, arx.owner)
    r = bearer_app("203.0.113.41", arx).get(ME, headers={**b(arx.token(arx.owner)), HEADER: "pk1:a.b.c.d"})
    assert r.status_code == 401 and r.json()["code"] == "second_factor_invalid"
    row = arx.audit("auth.second_factor.failed")[-1]
    assert details(row)["method"] == "passkey" and details(row)["why"] == "passkey_not_offered"


def test_the_compliance_view_counts_the_passkey_of_a_home_system_user_while_on(arx):
    from smplwise.services import factor_policy as fp

    configure(arx)
    add_passkey(arx, arx.viewer)
    person = {"user_id": "u-viewer", "kind": "ha", "name": "דנה"}
    with arx.db.connection(mode="read") as conn:
        assert fp._factor_of(conn, person, {}) is None
    switch(arx)
    with arx.db.connection(mode="read") as conn:
        assert fp._factor_of(conn, person, {}) == "passkey"
        assert psi.counts(conn, "u-viewer") is True
    arx.setting("security.passkeys_all_users", "off")  # the passkeys of home-system users do not count at all then
    with arx.db.connection(mode="read") as conn:
        assert psi.counts(conn, "u-viewer") is False


def test_no_public_address_no_offer(arx):
    configure(arx)
    add_passkey(arx, arx.viewer)
    switch(arx)
    arx.setting("security.local_public_url", "")
    assert sign_in(arx, arx.token(arx.viewer)).status_code == 200  # the passkey does not count without its address: nothing to ask


def test_the_answer_format(arx):
    assert psi.parse_answer("pk1:a.b.c.d") == {"id": "a", "rawId": "a", "type": "public-key",
                                               "response": {"clientDataJSON": "b", "authenticatorData": "c", "signature": "d"}}
    assert psi.parse_answer("pk1:a.b.c.d.e")["response"]["userHandle"] == "e"
    for bad in ("", "pk1:", "pk1:a.b.c", "pk1:a..c.d", "pk1:a.b.c.d.e.f", "dk1:x:y", "pk1:" + "a" * psi.ANSWER_MAX):
        assert psi.parse_answer(bad) is None, bad


def test_no_audit_row_carries_a_credential_id_a_challenge_or_the_answer(arx):
    configure(arx)
    auth, _ = add_passkey(arx, arx.viewer, label="מחשב של דנה")
    switch(arx)
    token = arx.token(arx.viewer)
    o = offer_of(sign_in(arx, token))
    sign_in(arx, token, pk_answer(auth.get(o["passkey"], tamper=True)))
    o = offer_of(sign_in(arx, token))
    answer = pk_answer(auth.get(o["passkey"]))
    assert sign_in(arx, token, answer).status_code == 200
    with arx.db.connection(mode="read") as conn:
        text = json.dumps([dict(r) for r in conn.execute("SELECT * FROM audit_log").fetchall()], ensure_ascii=False)
    assert b64u(auth.credential_id) not in text and o["passkey"]["publicKey"]["challenge"] not in text
    assert "pk1:" not in text and "מחשב של דנה" not in text


def test_the_local_channel_never_runs_the_exchange(arx):
    """The exchange lives on the remote channel only; the local channel (Ingress) is untouched by the switch."""
    configure(arx)
    switch(arx)
    local = TestClient(arx.app)
    assert local.get("/api/v1/me").status_code == 200
