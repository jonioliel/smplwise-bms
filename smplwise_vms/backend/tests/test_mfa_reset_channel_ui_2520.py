"""MFA-RESET-CHANNEL-UI-2520: a home-system user whom the remote sign-in answers "enrol first" (the sign-in factor policy requires a
factor, the user has none) registers a passkey AS that enrolment inside the same sign-in (services/passkey_sign_in_enrol.py, the browser
exchange of services/ha_user_auth.py) - only while the owner's switch `security.passkey_remote_factor` is on.

A software authenticator (tests/webauthn_fake.py) stands in for a real device; the fake Home Assistant core of test_remote_access.py
issues the tokens. Covered: off = the 403 of before (byte-identical details, an enrolment answer not even read); on = the offer
(creation options for the configured public address), the enrolment completes the sign-in with a fresh step-up proof and the passkey then
counts at the next sign-in; user verification for an administrator; the offer bound to the user and the Home Assistant sign-in, single
use; the fresh-sign-in rule (a token older than 5 minutes gets no offer and a late answer is refused); the enforced global policy's path
(no MFA reported by the home system); no offer after an administrator's reset, with the all-users switch off, without a public address or
on the bearer path; the answer format; audit hygiene. Also the reset channel setting the second-factor tab now shows (N-7): its rules
are the server's (MFA-RESET-HARDENING-2510) and unchanged."""
from __future__ import annotations

import itertools
import json
import time

from fastapi.testclient import TestClient

from smplwise.services import passkey_sign_in_enrol as pke
from test_mfa_passkeys_2490 import PUBLIC, configure, details
from test_second_factor import HEADER, arx  # noqa: F401 - `arx` is the fixture
from test_second_factor_followups import ME, b, bearer_app, put
from webauthn_fake import FakeAuthenticator, b64u

SESSION = "/arx/api/v1/auth/session"
SWITCH = "security.passkey_remote_factor"
_ips = itertools.count(10)


def sign_in(arx, token: str, answer: str | None = None):
    """One exchange with a FIXED Home Assistant token (the page retries with the same token), each from its own documentation address."""
    arx.client.cookies.clear()
    headers = {"Authorization": f"Bearer {token}", "CF-Connecting-IP": f"198.51.100.{next(_ips) % 250 + 1}"}
    if answer is not None:
        headers[HEADER] = answer
    return arx.client.post(SESSION, headers=headers)


def enrol_answer(cred: dict) -> str:
    r = cred["response"]
    return "pkr1:" + ".".join([cred["rawId"], r["clientDataJSON"], r["attestationObject"]] + ([",".join(r["transports"])] if r.get("transports") else []))


def enrol_offer(r) -> dict:
    assert r.status_code == 403 and r.json()["code"] == "second_factor_enrollment_required", r.text
    return r.json()["details"]["passkey_enrol"]


def required(arx, user_id: str) -> None:
    """The per-user override `required` (the user row exists after one sign-in, made before the policy applies)."""
    user = {"u-viewer": arx.viewer, "u-owner": arx.owner}[user_id]
    assert sign_in(arx, arx.token(user)).status_code == 200
    assert put(arx, "user", user_id, "required").status_code == 200
    arx.client.cookies.clear()


# ---------------------------------------------------------------- off: the answer of before

def test_off_the_enrolment_refusal_is_unchanged_and_an_enrolment_answer_is_not_read(arx):
    configure(arx)
    required(arx, "u-viewer")
    r = sign_in(arx, arx.token(arx.viewer))
    assert r.status_code == 403 and r.json()["code"] == "second_factor_enrollment_required" and r.json()["details"] == {}
    r = sign_in(arx, arx.token(arx.viewer), "pkr1:a.b.c")
    assert r.status_code == 403 and r.json()["details"] == {}  # not 401: the header is ignored as before
    assert not arx.audit("auth.second_factor.failed")
    assert all("passkey_enrol" not in (row["details_json"] or "") for row in arx.audit("auth.remote_session.rejected"))


# ---------------------------------------------------------------- on: a passkey is the enrolment

def test_on_a_user_who_must_enrol_registers_a_passkey_and_signs_in(arx):
    configure(arx)
    required(arx, "u-viewer")
    arx.setting(SWITCH, "on")
    token = arx.token(arx.viewer)
    offer = enrol_offer(sign_in(arx, token))
    assert offer["origin"] == PUBLIC and offer["user_verification_required"] is False
    pk = offer["publicKey"]
    assert pk["rp"]["id"] == "arx.example.com" and pk["authenticatorSelection"]["userVerification"] == "preferred"
    assert pk["authenticatorSelection"]["residentKey"] == "required" and pk["excludeCredentials"] == []
    auth = FakeAuthenticator()
    r = sign_in(arx, token, enrol_answer(auth.create({"publicKey": pk})))
    assert r.status_code == 200, r.text
    assert r.json()["user"]["id"] == "u-viewer"
    reg = arx.audit("auth.passkey.registered")[-1]
    d = details(reg)
    assert reg["actor_user_id"] == "u-viewer" and d["step"] == "sign_in_enrol" and d["first_factor"] is True
    created = arx.audit("auth.remote_session.created")[-1]
    assert details(created)["second_factor"] == "passkey_enrol"
    # the session starts with a fresh step-up proof, as after the code
    st = arx.client.get("/arx/api/v1/auth/step-up").json()
    assert st["methods"] == ["passkey"] and st.get("valid_until")
    # the next sign-in: the passkey is now the user's factor (asked, not "enrol first")
    r = sign_in(arx, arx.token(arx.viewer))
    assert r.status_code == 401 and r.json()["code"] == "second_factor_required" and r.json()["details"]["methods"] == ["passkey"]


def test_an_administrator_must_verify_the_user_on_the_device(arx):
    configure(arx)
    required(arx, "u-owner")
    arx.setting(SWITCH, "on")
    token = arx.token(arx.owner)
    offer = enrol_offer(sign_in(arx, token))
    assert offer["user_verification_required"] is True and offer["publicKey"]["authenticatorSelection"]["userVerification"] == "required"
    r = sign_in(arx, token, enrol_answer(FakeAuthenticator(uv=False).create({"publicKey": offer["publicKey"]})))
    assert r.status_code == 401 and r.json()["code"] == "second_factor_invalid"
    row = arx.audit("auth.second_factor.failed")[-1]
    assert details(row)["method"] == "passkey" and details(row)["why"].startswith("enrol_")
    assert not arx.audit("auth.passkey.registered")
    offer = enrol_offer(sign_in(arx, token))  # the step stays: a fresh offer, and a verifying device passes
    assert sign_in(arx, token, enrol_answer(FakeAuthenticator().create({"publicKey": offer["publicKey"]}))).status_code == 200


def test_the_offer_is_bound_to_the_sign_in_single_use_and_checked(arx):
    configure(arx)
    required(arx, "u-viewer")
    arx.setting(SWITCH, "on")
    token = arx.token(arx.viewer)
    offer = enrol_offer(sign_in(arx, token))
    good = FakeAuthenticator().create({"publicKey": offer["publicKey"]})
    other = arx.token(arx.viewer)  # another Home Assistant sign-in of the same user
    r = sign_in(arx, other, enrol_answer(good))
    assert r.status_code == 401 and details(arx.audit("auth.second_factor.failed")[-1])["why"] == "enrol_challenge_mismatch"
    r = sign_in(arx, token, enrol_answer(good))  # spent by the first presentation
    assert r.status_code == 401 and details(arx.audit("auth.second_factor.failed")[-1])["why"] == "enrol_challenge_unknown"

    def refused(**create_kw) -> str:
        o = enrol_offer(sign_in(arx, token))
        r = sign_in(arx, token, enrol_answer(FakeAuthenticator().create({"publicKey": o["publicKey"]}, **create_kw)))
        assert r.status_code == 401 and r.json()["code"] == "second_factor_invalid", r.text
        return details(arx.audit("auth.second_factor.failed")[-1])["why"]

    assert "origin" in refused(origin="https://evil.example.com")
    assert refused(rp_id="evil.example.com").startswith("enrol_")
    assert refused(up=False).startswith("enrol_")
    assert refused(kind="webauthn.get").startswith("enrol_")
    r = sign_in(arx, token, "pkr1:only.two")
    assert r.status_code == 401 and details(arx.audit("auth.second_factor.failed")[-1])["why"] == "enrol_malformed"
    assert not arx.audit("auth.passkey.registered")
    o = enrol_offer(sign_in(arx, token))  # after all that the right ceremony still passes
    assert sign_in(arx, token, enrol_answer(FakeAuthenticator().create({"publicKey": o["publicKey"]}))).status_code == 200


def test_the_fresh_sign_in_rule_no_offer_for_an_old_token_and_a_late_answer_is_refused(arx, monkeypatch):
    configure(arx)
    required(arx, "u-viewer")
    arx.setting(SWITCH, "on")
    token = arx.token(arx.viewer)
    offer = enrol_offer(sign_in(arx, token))
    cred = FakeAuthenticator().create({"publicKey": offer["publicKey"]})

    class Later:
        @staticmethod
        def time() -> float:
            return time.time() + 301  # the sign-in is now older than 5 minutes (step_up.RECENT_SIGN_IN_S)

    monkeypatch.setattr(pke, "time", Later)
    r = sign_in(arx, token, enrol_answer(cred))
    assert r.status_code == 401 and details(arx.audit("auth.second_factor.failed")[-1])["why"] == "enrol_not_offered"
    r = sign_in(arx, token)
    assert r.status_code == 403 and r.json()["details"] == {}  # no offer any more: sign in again
    assert not arx.audit("auth.passkey.registered")
    monkeypatch.setattr(pke, "time", time)  # the real clock again (never undo(): the fixture patches with the same monkeypatch)
    now = time.time()
    assert pke.token_fresh(token, now=now) is True and pke.token_fresh(token, now=now + 301) is False
    assert pke.token_fresh(token, now=now - 120) is False  # issued "in the future" beyond the skew allowance
    assert pke.token_fresh("not.a.jwt") is False and pke.token_fresh(None) is False


def test_the_enforced_global_policy_path_offers_the_passkey_too(arx):
    from smplwise.services import factor_policy as fp

    configure(arx)
    arx.setting(fp.POLICY_KEY, "all")
    arx.setting(fp.MODE_KEY, "enforce")
    arx.setting(SWITCH, "on")
    token = arx.token(arx.viewer)
    r = sign_in(arx, token)
    assert r.status_code == 403 and r.json()["details"]["provenance"] == "no_ha_mfa"
    offer = r.json()["details"]["passkey_enrol"]
    r = sign_in(arx, token, enrol_answer(FakeAuthenticator().create({"publicKey": offer["publicKey"]})))
    assert r.status_code == 200, r.text
    created = details(arx.audit("auth.remote_session.created")[-1])
    assert created["second_factor"] == "passkey_enrol"


def test_no_offer_after_an_administrators_reset_without_all_users_passkeys_without_an_address_or_on_the_bearer_path(arx, monkeypatch):
    from smplwise.services import factor_reset

    configure(arx)
    required(arx, "u-viewer")
    arx.setting(SWITCH, "on")
    assert "passkey_enrol" in sign_in(arx, arx.token(arx.viewer)).json()["details"]
    # the bearer path (a native client): unchanged, no offer
    r = bearer_app("203.0.113.40", arx).get(ME, headers=b(arx.token(arx.viewer)))
    assert r.status_code == 403 and "passkey_enrol" not in (r.json().get("details") or {})
    arx.setting("security.passkeys_all_users", "off")
    r = sign_in(arx, arx.token(arx.viewer))
    assert r.status_code == 403 and r.json()["details"] == {}
    arx.setting("security.passkeys_all_users", "on")
    arx.setting("security.local_public_url", "")
    r = sign_in(arx, arx.token(arx.viewer))
    assert r.status_code == 403 and r.json()["details"] == {}
    configure(arx)
    monkeypatch.setattr(factor_reset, "must_enroll", lambda conn, uid: True)  # an administrator reset this user's factors
    r = sign_in(arx, arx.token(arx.viewer))
    assert r.status_code == 403 and "passkey_enrol" not in r.json()["details"]


def test_the_answer_format():
    assert pke.parse_answer("pkr1:a.b.c") == {"id": "a", "rawId": "a", "type": "public-key", "response": {"clientDataJSON": "b", "attestationObject": "c"}}
    assert pke.parse_answer("pkr1:a.b.c.internal,hybrid")["response"]["transports"] == ["internal", "hybrid"]
    for bad in ("", "pkr1:", "pkr1:a.b", "pkr1:a..c", "pkr1:a.b.c.d.e", "pk1:a.b.c.d", "pkr1:" + "a" * pke.ANSWER_MAX):
        assert pke.parse_answer(bad) is None, bad


def test_no_audit_row_carries_a_credential_id_a_challenge_or_the_answer(arx):
    configure(arx)
    required(arx, "u-viewer")
    arx.setting(SWITCH, "on")
    token = arx.token(arx.viewer)
    o = enrol_offer(sign_in(arx, token))
    sign_in(arx, token, enrol_answer(FakeAuthenticator().create({"publicKey": o["publicKey"]}, origin="https://evil.example.com")))
    o = enrol_offer(sign_in(arx, token))
    auth = FakeAuthenticator()
    assert sign_in(arx, token, enrol_answer(auth.create({"publicKey": o["publicKey"]}))).status_code == 200
    with arx.db.connection(mode="read") as conn:
        text = json.dumps([dict(r) for r in conn.execute("SELECT * FROM audit_log").fetchall()], ensure_ascii=False)
    assert b64u(auth.credential_id) not in text and o["publicKey"]["challenge"] not in text and "pkr1:" not in text


# ---------------------------------------------------------------- N-7: the reset channel the tab now shows (server rules unchanged)

def test_the_reset_channel_setting_the_tab_writes(arx):
    local = configure(arx)
    assert local.get("/api/v1/settings").json()["settings"]["security.factor_reset_channel"] == "any"
    assert local.patch("/api/v1/settings", json={"security.factor_reset_channel": "everywhere"}).status_code == 422
    assert local.patch("/api/v1/settings", json={"security.factor_reset_channel": "local"}).status_code == 200
    row = arx.audit("security.factor_reset_channel")[-1]
    assert row["decision"] == "allowed" and details(row) == {"to": "local"}
    assert local.patch("/api/v1/settings", json={"security.factor_reset_channel": "any"}).status_code == 200  # the local channel widens
    assert TestClient(arx.app).get("/api/v1/settings").json()["settings"]["security.factor_reset_channel"] == "any"
