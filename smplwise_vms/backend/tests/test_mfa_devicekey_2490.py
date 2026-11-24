"""MFA-DEVICEKEY-2490 (MFA-STEPUP-TRAIN-2490 slice 8): the Android app's phone key (services/device_keys.py, routers/device_keys.py).

Owner decisions 2026-11-22: Q51 (in the app, password + phone key counts as two-factor) and q23 b (biometric or the phone's screen lock).
The phone is simulated with generated P-256 keys (`cryptography`), signing exactly the payload the server hands out. Covered: register
(proof of possession, payload shape, audit, notice, no key material in answers), a bad registration signature, a duplicate key, the
proof needed for a second key / a revoke, step-up with the phone key (good / bad signature, replayed challenge, another user's key, a
revoked key, wrong origin / purpose), the lockout, the rate limits, the sign-in factor (Q51) through `X-Arx-Second-Factor`, the public
sign-in challenge, the `security.device_key_auth` setting and the backup / privacy lists."""
from __future__ import annotations

import base64
import json

import pytest
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient

from smplwise.services import device_keys as dk
from smplwise.services import step_up
from test_remote_access import ORIGIN
from test_second_factor import HEADER, arx, bump_step, code_now, enrol, fresh_login  # noqa: F401 - `arx` is the fixture

API = "/arx/api/v1"
CHALLENGE = f"{API}/auth/device-keys/challenge"
SIGN_IN_CHALLENGE = f"{API}/auth/device-keys/sign-in/challenge"
KEYS = f"{API}/auth/device-keys"
VERIFY = f"{API}/auth/step-up/verify"
SETTINGS = f"{API}/settings"
ORIGIN_URL = "http://testserver"


def b64u(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


class Phone:
    """A phone's Keystore key: EC P-256, SHA256withECDSA, the SPKI DER as Android's PublicKey.getEncoded()."""

    def __init__(self) -> None:
        self.key = ec.generate_private_key(ec.SECP256R1())
        self.key_id: str | None = None

    def public_key(self) -> str:
        return b64u(self.key.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo))

    def sign(self, payload: str) -> str:
        return b64u(self.key.sign(payload.encode("utf-8"), ec.ECDSA(hashes.SHA256())))


class Clock:
    def __init__(self, monkeypatch):
        self.t = step_up._now()
        monkeypatch.setattr(step_up, "_now", lambda: self.t)

    def advance(self, minutes: float) -> None:
        self.t += minutes * 60


@pytest.fixture()
def clock(monkeypatch):
    return Clock(monkeypatch)


def details(row: dict) -> dict:
    return json.loads(row["details_json"] or "{}")


def register(arx, phone: Phone, *, auth_kind: str = "biometric_or_screen_lock", label: str = "Pixel", signer: Phone | None = None):
    ch = arx.client.post(CHALLENGE, json={"purpose": "register"})
    assert ch.status_code == 200, ch.text
    c = ch.json()
    r = arx.client.post(KEYS, json={"challenge_id": c["challenge_id"], "public_key": phone.public_key(), "signature": (signer or phone).sign(c["payload"]),
                                    "label": label, "auth_kind": auth_kind})
    if r.status_code == 200:
        phone.key_id = r.json()["id"]
    return r


def step_up_challenge(arx, phone: Phone, action: str | None = "system.configure", key_id: str | None = None) -> dict:
    body = {"purpose": "step_up", "key_id": key_id or phone.key_id}
    if action:
        body["action"] = action
    r = arx.client.post(CHALLENGE, json=body)
    assert r.status_code == 200, r.text
    return r.json()


def verify(arx, phone: Phone, c: dict, *, action: str | None = "system.configure", signer: Phone | None = None, key_id: str | None = None):
    body = {"method": "device_key", "challenge_id": c["challenge_id"], "key_id": key_id or phone.key_id, "signature": (signer or phone).sign(c["payload"])}
    if action:
        body["action"] = action
    return arx.client.post(VERIFY, json=body)


def prove(arx, phone: Phone, action: str = "system.configure"):
    r = verify(arx, phone, step_up_challenge(arx, phone, action), action=action)
    assert r.status_code == 200, r.text
    return r


def title(arx, value: str):
    return arx.client.patch(SETTINGS, json={"home.title": value})


def key_row(arx, key_id: str) -> dict:
    with arx.db.connection(mode="read") as conn:
        return dict(conn.execute("SELECT * FROM auth_device_keys WHERE id = ?", (key_id,)).fetchone())


# ---------------------------------------------------------------- registration

def test_register_stores_the_public_key_only_audits_and_tells_the_user(arx):
    assert fresh_login(arx, arx.viewer).status_code == 200
    phone = Phone()
    ch = arx.client.post(CHALLENGE, json={"purpose": "register"}).json()
    assert ch["purpose"] == "register" and ch["expires_in"] == 60 and ch["auth_kind"] == "biometric_or_screen_lock"
    assert ch["allowed_auth_kinds"] == ["biometric", "biometric_or_screen_lock"]
    assert ch["payload"] == f"arx-device-key|v1|register|{ORIGIN_URL}|u-viewer|-|-|{ch['challenge_id']}" and ch["challenge_id"].startswith("dkn_")
    r = arx.client.post(KEYS, json={"challenge_id": ch["challenge_id"], "public_key": phone.public_key(), "signature": phone.sign(ch["payload"]),
                                    "label": "Pixel 8", "auth_kind": "biometric_or_screen_lock"})
    assert r.status_code == 200, r.text
    row = r.json()
    assert set(row) == {"id", "label", "auth_kind", "platform", "created_at", "last_used_at", "attested"}
    assert row["label"] == "Pixel 8" and row["platform"] == "android" and row["attested"] == "not_checked" and row["id"].startswith("dk_")
    stored = key_row(arx, row["id"])
    assert stored["user_id"] == "u-viewer" and stored["alg"] == "ES256" and stored["revoked_at"] is None and stored["attestation_json"] is None
    listed = arx.client.get(KEYS).json()
    assert [k["id"] for k in listed["keys"]] == [row["id"]] and listed["max"] == dk.MAX_KEYS_PER_USER
    audit = arx.audit("auth.device_key.registered")[-1]
    assert audit["decision"] == "allowed" and audit["resource_id"] == row["id"] and details(audit)["fp"] == stored["fp"][:16]
    assert phone.public_key() not in json.dumps(listed) and phone.public_key() not in json.dumps(details(audit))
    with arx.db.connection(mode="read") as conn:
        n = conn.execute("SELECT n.id FROM notifications n JOIN notification_recipients r ON r.notification_id = n.id "
                         "WHERE n.source = 'security.device_key_added' AND r.user_id = 'u-viewer'").fetchall()
    assert len(n) == 1
    st = arx.client.get(f"{API}/auth/step-up").json()
    assert st["methods"] == ["device_key"]


def test_a_registration_signed_by_another_key_is_refused_and_the_challenge_is_spent(arx):
    assert fresh_login(arx, arx.viewer).status_code == 200
    phone, thief = Phone(), Phone()
    ch = arx.client.post(CHALLENGE, json={"purpose": "register"}).json()
    bad = arx.client.post(KEYS, json={"challenge_id": ch["challenge_id"], "public_key": phone.public_key(), "signature": thief.sign(ch["payload"]),
                                      "auth_kind": "biometric"})
    assert bad.status_code == 400 and bad.json()["code"] == "device_key_invalid"
    again = arx.client.post(KEYS, json={"challenge_id": ch["challenge_id"], "public_key": phone.public_key(), "signature": phone.sign(ch["payload"]),
                                        "auth_kind": "biometric"})
    assert again.status_code == 400 and again.json()["details"]["reason"] == "challenge"  # single use
    refused = arx.audit("auth.device_key.refused")
    assert [details(r)["why"] for r in refused] == ["signature", "challenge"]
    assert arx.client.get(KEYS).json()["keys"] == []


def test_the_same_key_cannot_be_registered_twice(arx, clock):
    assert fresh_login(arx, arx.viewer).status_code == 200
    phone = Phone()
    assert register(arx, phone).status_code == 200
    prove(arx, phone, "auth.device_key.register")  # a second key needs a proof (the user has a method now)
    r = register(arx, Phone(), signer=None)
    assert r.status_code == 200
    dup = arx.client.post(CHALLENGE, json={"purpose": "register"}).json()
    r2 = arx.client.post(KEYS, json={"challenge_id": dup["challenge_id"], "public_key": phone.public_key(), "signature": phone.sign(dup["payload"]),
                                     "auth_kind": "biometric"})
    assert r2.status_code == 409 and r2.json()["code"] == "device_key_exists"


def test_a_second_key_needs_a_fresh_proof_on_the_remote_channel(arx, clock):
    assert fresh_login(arx, arx.viewer).status_code == 200
    first = Phone()
    assert register(arx, first).status_code == 200
    r = register(arx, Phone())
    assert r.status_code == 403 and r.json()["code"] == "step_up_required" and r.json()["details"]["action"] == "auth.device_key.register"
    assert r.json()["details"]["methods"] == ["device_key"]
    prove(arx, first, "auth.device_key.register")
    assert register(arx, Phone()).status_code == 200
    clock.advance(6)  # the proof ran out
    assert register(arx, Phone()).status_code == 403


def test_the_auth_kind_setting_biometric_refuses_a_screen_lock_key(arx):
    arx.setting("security.device_key_auth", "biometric")
    assert fresh_login(arx, arx.viewer).status_code == 200
    ch = arx.client.post(CHALLENGE, json={"purpose": "register"}).json()
    assert ch["auth_kind"] == "biometric" and ch["allowed_auth_kinds"] == ["biometric"]
    r = register(arx, Phone(), auth_kind="biometric_or_screen_lock")
    assert r.status_code == 422 and r.json()["code"] == "device_key_auth_kind"
    assert register(arx, Phone(), auth_kind="biometric").status_code == 200


# ---------------------------------------------------------------- step-up with the phone key

def test_the_phone_key_answers_step_up_and_opens_the_window(arx, clock):
    assert fresh_login(arx, arx.owner).status_code == 200
    phone = Phone()
    assert register(arx, phone).status_code == 200  # the first factor of the account: no proof needed
    r = title(arx, "A")
    assert r.status_code == 403 and r.json()["details"]["methods"] == ["device_key"]
    c = step_up_challenge(arx, phone)
    assert c["payload"] == f"arx-device-key|v1|step_up|{ORIGIN_URL}|u-owner|{phone.key_id}|system.configure|{c['challenge_id']}"
    v = verify(arx, phone, c)
    assert v.status_code == 200, v.text
    assert v.json()["method"] == "device_key" and v.json()["minutes"] == 5 and v.json()["valid_until"]
    ok = arx.audit("auth.step_up.ok")[-1]
    assert details(ok)["method"] == "device_key" and details(ok)["action"] == "system.configure" and details(ok)["key_id"] == phone.key_id
    assert title(arx, "B").status_code == 200
    row = key_row(arx, phone.key_id)
    assert row["sign_count"] == 1 and row["last_used_at"]
    clock.advance(5.1)
    assert title(arx, "C").status_code == 403


def test_a_bad_signature_is_refused_and_audited(arx):
    assert fresh_login(arx, arx.owner).status_code == 200
    phone = Phone()
    assert register(arx, phone).status_code == 200
    r = verify(arx, phone, step_up_challenge(arx, phone), signer=Phone())
    assert r.status_code == 400 and r.json()["code"] == "second_factor_invalid"
    failed = arx.audit("auth.step_up.failed")[-1]
    assert failed["decision"] == "denied" and failed["reason"] == "step_up_invalid"
    assert details(failed)["method"] == "device_key" and details(failed)["why"] == "signature"
    assert title(arx, "X").status_code == 403


def test_a_replayed_challenge_is_refused(arx):
    assert fresh_login(arx, arx.owner).status_code == 200
    phone = Phone()
    assert register(arx, phone).status_code == 200
    c = step_up_challenge(arx, phone)
    assert verify(arx, phone, c).status_code == 200
    again = verify(arx, phone, c)
    assert again.status_code == 400 and details(arx.audit("auth.step_up.failed")[-1])["why"] == "challenge_unknown"


def test_a_proof_for_another_action_does_not_verify(arx):
    assert fresh_login(arx, arx.owner).status_code == 200
    phone = Phone()
    assert register(arx, phone).status_code == 200
    c = step_up_challenge(arx, phone, action="system.configure")
    r = verify(arx, phone, c, action="rbac.assign")
    assert r.status_code == 400 and details(arx.audit("auth.step_up.failed")[-1])["why"] == "challenge_mismatch"


def test_another_users_key_cannot_answer(arx):
    viewer_phone, owner_phone = Phone(), Phone()
    assert fresh_login(arx, arx.viewer).status_code == 200
    assert register(arx, viewer_phone).status_code == 200
    assert fresh_login(arx, arx.owner).status_code == 200
    assert register(arx, owner_phone).status_code == 200
    # the owner's session names the viewer's key and the viewer's phone signs: the key is not the owner's
    c = step_up_challenge(arx, owner_phone, key_id=viewer_phone.key_id)
    r = verify(arx, viewer_phone, c)
    assert r.status_code == 400 and details(arx.audit("auth.step_up.failed")[-1])["why"] == "key_unknown"
    assert title(arx, "X").status_code == 403


def test_a_revoked_key_cannot_answer(arx):
    assert fresh_login(arx, arx.owner).status_code == 200
    phone, spare = Phone(), Phone()
    assert register(arx, phone).status_code == 200
    prove(arx, phone, "auth.device_key.register")
    assert register(arx, spare).status_code == 200
    c = step_up_challenge(arx, phone)
    with arx.db.connection() as conn:
        assert dk.revoke(conn, "u-owner", phone.key_id, by="test", reason="lost") is not None
    r = verify(arx, phone, c)
    assert r.status_code == 400 and details(arx.audit("auth.step_up.failed")[-1])["why"] == "key_unknown"


def test_revoking_needs_a_proof_and_drops_the_proofs(arx, clock):
    assert fresh_login(arx, arx.owner).status_code == 200
    phone = Phone()
    assert register(arx, phone).status_code == 200
    r = arx.client.delete(f"{KEYS}/{phone.key_id}")
    assert r.status_code == 403 and r.json()["details"]["action"] == "auth.device_key.revoke"
    assert arx.audit("auth.device_key.refused")[-1]["reason"] == "step_up_required"
    prove(arx, phone, "auth.device_key.revoke")
    ok = arx.client.delete(f"{KEYS}/{phone.key_id}")
    assert ok.status_code == 200 and ok.json() == {"id": phone.key_id, "revoked": True}
    assert key_row(arx, phone.key_id)["revoked_at"] and arx.audit("auth.device_key.revoked")[-1]["resource_id"] == phone.key_id
    assert arx.client.get(KEYS).json()["keys"] == []
    assert arx.client.delete(f"{KEYS}/{phone.key_id}").status_code == 404
    st = arx.client.get(f"{API}/auth/step-up").json()
    assert st["applies"] is False and st["reason"] == "no_method"  # the last factor went; today's behaviour again


def test_wrong_signatures_lock_the_phone_key_method(arx):
    assert fresh_login(arx, arx.owner).status_code == 200
    phone = Phone()
    assert register(arx, phone).status_code == 200
    codes = [verify(arx, phone, step_up_challenge(arx, phone), signer=Phone()).status_code for _ in range(5)]
    assert codes == [400, 400, 400, 400, 429]
    locked = verify(arx, phone, step_up_challenge(arx, phone))  # even a good signature, while locked
    assert locked.status_code == 429 and locked.json()["code"] == "second_factor_locked"


def test_challenges_are_rate_limited_per_user(arx):
    assert fresh_login(arx, arx.viewer).status_code == 200
    codes = [arx.client.post(CHALLENGE, json={"purpose": "register"}).status_code for _ in range(21)]
    assert codes[:20] == [200] * 20 and codes[20] == 429


def test_the_service_binds_origin_purpose_and_user(arx):
    phone = Phone()
    assert fresh_login(arx, arx.owner).status_code == 200
    assert register(arx, phone).status_code == 200
    with arx.db.connection() as conn:
        cid, text, _ = dk.issue(dk.PURPOSE_STEP_UP, "https://evil.example", user_id="u-owner", key_id=phone.key_id, session="s")
        with pytest.raises(dk.DeviceKeyError) as e1:
            dk.check(conn, "u-owner", cid, phone.sign(text), purpose=dk.PURPOSE_STEP_UP, origin=ORIGIN_URL, session="s")
        assert e1.value.reason == "challenge_mismatch"
        cid, text, _ = dk.issue(dk.PURPOSE_SIGN_IN, ORIGIN_URL, key_id=phone.key_id)
        with pytest.raises(dk.DeviceKeyError) as e2:  # a sign-in signature is never a step-up proof
            dk.check(conn, "u-owner", cid, phone.sign(text), purpose=dk.PURPOSE_STEP_UP, origin=ORIGIN_URL, session="s")
        assert e2.value.reason == "challenge_mismatch"
        cid, text, _ = dk.issue(dk.PURPOSE_SIGN_IN, ORIGIN_URL, key_id=phone.key_id)
        with pytest.raises(dk.DeviceKeyError) as e3:  # the owner's key as the viewer's factor
            dk.check(conn, "u-viewer", cid, phone.sign(text), purpose=dk.PURPOSE_SIGN_IN, origin=ORIGIN_URL)
        assert e3.value.reason == "key_unknown"
        cid, text, _ = dk.issue(dk.PURPOSE_SIGN_IN, ORIGIN_URL, key_id=phone.key_id)
        assert dk.check(conn, "u-owner", cid, phone.sign(text), purpose=dk.PURPOSE_SIGN_IN, origin=ORIGIN_URL)["id"] == phone.key_id
    with pytest.raises(ValueError):
        dk.payload("step_up", "https://a|b", "u", None, None, "n")


# ---------------------------------------------------------------- the sign-in factor (owner Q51)

def sign_in_answer(arx, phone: Phone) -> str:
    anon = TestClient(arx.app, headers=ORIGIN)
    r = anon.post(SIGN_IN_CHALLENGE, json={"key_id": phone.key_id})
    assert r.status_code == 200, r.text
    c = r.json()
    assert c["payload"] == f"arx-device-key|v1|sign_in|{ORIGIN_URL}|-|{phone.key_id}|-|{c['challenge_id']}" and c["header"] == HEADER
    return f"{c['answer_prefix']}{c['challenge_id']}:{phone.sign(c['payload'])}"


def test_password_plus_phone_key_is_the_second_factor_of_a_sign_in(arx):
    enrol(arx, arx.viewer)  # the authenticator code; the enrolment's own proof lets the session add a phone key
    phone = Phone()
    assert register(arx, phone).status_code == 200
    assert fresh_login(arx, arx.viewer).status_code == 401  # a new sign-in owes the factor
    ok = fresh_login(arx, arx.viewer, sign_in_answer(arx, phone))
    assert ok.status_code == 200, ok.text
    created = arx.audit("auth.remote_session.created")[-1]
    assert created["actor_user_id"] == "u-viewer"
    bad = fresh_login(arx, arx.viewer, f"dk1:dkn_{'x' * 43}:{phone.sign('nothing')}")  # an unknown (or replayed) challenge
    assert bad.status_code == 401 and bad.json()["code"] == "second_factor_invalid"
    failed = arx.audit("auth.second_factor.failed")[-1]
    assert details(failed)["method"] == "device_key" and details(failed)["why"] == "challenge_unknown"
    bump_step(arx, "u-viewer")
    assert fresh_login(arx, arx.viewer, code_now(arx, "u-viewer")).status_code == 200  # the authenticator code still works


def test_a_phone_key_alone_satisfies_a_required_policy(arx):
    assert fresh_login(arx, arx.owner).status_code == 200
    phone = Phone()
    assert register(arx, phone).status_code == 200
    arx.setting("security.second_factor_policy", "admins")  # the owner is an administrator: a factor is required
    r = fresh_login(arx, arx.owner)
    assert r.status_code == 401 and r.json()["code"] == "second_factor_required"  # not "enrol first": the phone key is a factor
    assert fresh_login(arx, arx.owner, sign_in_answer(arx, phone)).status_code == 200


def test_the_public_sign_in_challenge_does_not_tell_whether_a_key_exists(arx):
    anon = TestClient(arx.app, headers=ORIGIN)
    r = anon.post(SIGN_IN_CHALLENGE, json={"key_id": "dk_" + "0" * 24})
    assert r.status_code == 200 and set(r.json()) == {"challenge_id", "purpose", "payload", "expires_in", "answer_prefix", "header"}
    assert anon.post(SIGN_IN_CHALLENGE, json={"key_id": "nope"}).status_code == 422
    assert anon.post(CHALLENGE, json={"purpose": "register"}).status_code == 401  # the other routes need a signed-in user
    assert anon.get(KEYS).status_code == 401
    # the local channel (Ingress) has no sign-in: the uniform 404, before the body is read
    assert TestClient(arx.app).post("/api/v1/auth/device-keys/sign-in/challenge", json={}).status_code == 404


# ---------------------------------------------------------------- settings, backup, privacy

def test_defaults_backup_and_privacy_lists(arx):
    from smplwise.services import backup, local_privacy
    from smplwise.services.settings_store import DEFAULTS

    assert DEFAULTS["security.device_key_auth"] == "biometric_or_screen_lock"  # owner q23 b
    assert "security.device_key_auth" in backup.SETTINGS_KEEP and "auth_device_keys" in backup.NEVER_EXPORTED_TABLES
    assert ("auth_device_keys", "user_id") in local_privacy.DELETE_ROWS and "phone_keys" in local_privacy.EXPORT_LISTS
    local = TestClient(arx.app)
    assert local.patch("/api/v1/settings", json={"security.device_key_auth": "sometimes"}).status_code == 422
    assert local.patch("/api/v1/settings", json={"security.device_key_auth": "biometric"}).status_code == 200
    assert local.get("/api/v1/settings").json()["settings"]["security.device_key_auth"] == "biometric"
