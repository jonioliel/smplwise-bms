"""APPREFRESH2-295 (docs/changes/APPREFRESH-DEVICEKEY-SPEC.md, CR-APPREFRESH295 section 13): the device-bound key of the app refresh
token. A family minted with the public half of an ECDSA P-256 key needs, on EVERY refresh (the retry inside the 20 s grace included), a
signature over a single-use server nonce made with the private half; a stolen refresh token alone is useless. Covers: a valid proof (DER
and raw r||s, SPKI and X9.63 keys), a missing / invalid / replayed proof, the wrong key, the key of a previous registration, nonce expiry,
clock skew, a nonce of another family, the retry window with a proof, the three modes (off / optional / required) and their channel rule,
the mint's key checks, the challenge route (guard, unknown device, rate limit), the backup classification, the migration, and that no key
or signature material reaches the audit log, the log, or (nonces) any table. Fakes only: no Home Assistant, no phone."""
from __future__ import annotations

import json
import logging

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
from test_app_refresh_295 import (  # noqa: F401 - rx is the shared fixture
    API,
    ARX,
    INSTALL,
    assert_no_material,
    audit_rows,
    family_row,
    issue,
    on,
    refresh,
    register,
    rx,
    switch,
    whoami,
)

from smplwise.services import app_refresh as svc
from smplwise.services import app_refresh_key as dk
from smplwise.services import backup

MODE = svc.DEVICE_KEY_KEY
INSTALL2 = "22222222-2222-3333-4444-555555555555"


class Key:
    """The phone's hardware key, simulated: P-256, the private half never leaves this object."""

    def __init__(self, x963: bool = False, raw_sig: bool = False) -> None:
        self.k = ec.generate_private_key(ec.SECP256R1())
        pub = self.k.public_key()
        self.spki = pub.public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)
        data = pub.public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint) if x963 else self.spki
        self.text = dk.b64u_encode(data)
        self.fp = __import__("hashlib").sha256(self.spki).hexdigest()
        self.raw_sig = raw_sig
        self.sigs: list[str] = []

    def sign(self, message: bytes) -> str:
        der = self.k.sign(message, ec.ECDSA(hashes.SHA256()))
        if self.raw_sig:
            r, s = decode_dss_signature(der)
            out = dk.b64u_encode(r.to_bytes(32, "big") + s.to_bytes(32, "big"))
        else:
            out = dk.b64u_encode(der)
        self.sigs.append(out)
        return out


def now(rx) -> int:
    return int(rx.clock())


def key_body(rx, device_id: str, key: Key, ts: int | None = None, public_key: str | None = None) -> dict:
    ts = now(rx) if ts is None else ts
    text = public_key or key.text
    return {"alg": "ES256", "public_key": text, "proof": {"ts": ts, "sig": key.sign(dk.mint_message(device_id, ts, text))}}


def mint(rx, device_id: str, key: Key | None, user: str = "dana", install_id: str = INSTALL, body: dict | None = None):
    payload = {"device_id": device_id, "install_id": install_id}
    if body is not None:
        payload["device_key"] = body
    elif key is not None:
        payload["device_key"] = key_body(rx, device_id, key)
    r = rx.user(user).post(f"{ARX}/auth/app/refresh-tokens", json=payload)
    if r.status_code == 401:
        r = rx.user(user, fresh=True).post(f"{ARX}/auth/app/refresh-tokens", json=payload)
    if r.status_code == 201:
        rx.seen += [r.json()["refresh_token"], r.json()["access_token"]]
    return r


def challenge(rx, device_id: str, prefix: str = ARX):
    return rx.c.post(f"{prefix}/auth/app/refresh-challenge", json={"device_id": device_id})


def nonce_of(rx, device_id: str) -> str:
    r = challenge(rx, device_id)
    assert r.status_code == 200, r.text
    rx.nonces = getattr(rx, "nonces", []) + [r.json()["nonce"]]
    return r.json()["nonce"]


def proof(rx, key: Key, device_id: str, token: str, nonce: str | None = None, ts: int | None = None) -> dict:
    nonce = nonce or nonce_of(rx, device_id)
    ts = now(rx) if ts is None else ts
    return {"nonce": nonce, "ts": ts, "sig": key.sign(dk.refresh_message(device_id, nonce, ts, token))}


def prefresh(rx, token: str, device_id: str, pr: dict | None, install_id: str = INSTALL):
    body = {"refresh_token": token, "device_id": device_id, "install_id": install_id}
    if pr is not None:
        body["proof"] = pr
    r = rx.c.post(f"{ARX}/auth/app/refresh", json=body)
    if r.status_code == 200:
        rx.seen += [r.json()["refresh_token"], r.json()["access_token"]]
    return r


def keyed(rx, user: str = "dana", key: Key | None = None, install_id: str = INSTALL) -> tuple[dict, dict, Key]:
    on(rx)
    key = key or Key()
    dev = register(rx, user, install_id=install_id)
    r = mint(rx, dev["device_id"], key, user=user, install_id=install_id)
    assert r.status_code == 201, r.text
    return dev, r.json(), key


def token_state(rx, token: str) -> str | None:
    with rx.db.connection(mode="read") as conn:
        row = conn.execute("SELECT state FROM app_refresh_tokens WHERE token_hash = ?", (svc.token_hash(token),)).fetchone()
    return row["state"] if row else None


# ---------------------------------------------------------------- a valid proof

def test_a_valid_proof_refreshes_and_the_family_keeps_the_key(rx):
    dev, out, key = keyed(rx)
    assert out["device_key"] == {"bound": True, "alg": "ES256"} and out["proof_required"] is True
    fam = family_row(rx, out["family_id"])
    assert fam["device_key_fp"] == key.fp and fam["device_key_alg"] == "ES256" and dk.b64u_decode(fam["device_key_spki"]) == key.spki
    tok = out
    for _ in range(3):  # every rotation needs a fresh proof
        rx.clock.advance(60)
        r = prefresh(rx, tok["refresh_token"], dev["device_id"], proof(rx, key, dev["device_id"], tok["refresh_token"]))
        assert r.status_code == 200, r.text
        assert r.json()["proof_required"] is True
        tok = r.json()
    assert whoami(rx, tok["access_token"]).status_code == 200
    assert family_row(rx, out["family_id"])["generation"] == 4
    listed = rx.user("dana").get(f"{ARX}/auth/app/families").json()["families"]
    assert listed[0]["device_key_bound"] is True and key.text not in json.dumps(listed) and key.fp not in json.dumps(listed)


def test_the_ios_shapes_an_x963_key_and_a_raw_signature_verify_too(rx):
    dev, out, key = keyed(rx, key=Key(x963=True, raw_sig=True))
    assert family_row(rx, out["family_id"])["device_key_fp"] == key.fp  # normalised to SPKI DER
    r = prefresh(rx, out["refresh_token"], dev["device_id"], proof(rx, key, dev["device_id"], out["refresh_token"]))
    assert r.status_code == 200, r.text


# ---------------------------------------------------------------- missing / invalid / replayed / wrong key

def test_a_missing_proof_ends_a_keyed_family(rx):
    dev, out, _ = keyed(rx)
    r = prefresh(rx, out["refresh_token"], dev["device_id"], None)  # the token alone - a copy without the key
    assert r.status_code == 401 and r.json()["code"] == "app_refresh_invalid"
    assert family_row(rx, out["family_id"])["revoked_reason"] == "proof_missing"
    assert whoami(rx, out["access_token"]).status_code == 401
    assert [a["reason"] for a in audit_rows(rx, "auth.app_refresh.refused")] == ["proof_missing"]


def test_an_invalid_signature_ends_the_family(rx):
    dev, out, key = keyed(rx)
    pr = proof(rx, key, dev["device_id"], out["refresh_token"])
    pr["sig"] = dk.b64u_encode(b"\x30" + b"\x01" * 70)  # well-formed base64url, not a signature
    r = prefresh(rx, out["refresh_token"], dev["device_id"], pr)
    assert r.status_code == 401 and family_row(rx, out["family_id"])["revoked_reason"] == "proof_invalid"
    # a signature over the wrong message (another token) is invalid too
    dev2, out2, key2 = keyed(rx, "vera", install_id=INSTALL2)
    pr = proof(rx, key2, dev2["device_id"], "arxr_" + "x" * 43)
    assert prefresh(rx, out2["refresh_token"], dev2["device_id"], pr, install_id=INSTALL2).status_code == 401
    assert family_row(rx, out2["family_id"])["revoked_reason"] == "proof_invalid"


def test_the_wrong_key_ends_the_family(rx):
    dev, out, _ = keyed(rx)
    thief = Key()
    r = prefresh(rx, out["refresh_token"], dev["device_id"], proof(rx, thief, dev["device_id"], out["refresh_token"]))
    assert r.status_code == 401 and family_row(rx, out["family_id"])["revoked_reason"] == "proof_invalid"
    assert token_state(rx, out["refresh_token"]) == "revoked"


def test_a_replayed_proof_is_refused_and_ends_nothing(rx):
    dev, out, key = keyed(rx)
    pr = proof(rx, key, dev["device_id"], out["refresh_token"])
    first = prefresh(rx, out["refresh_token"], dev["device_id"], pr)
    assert first.status_code == 200
    t2 = first.json()
    rx.clock.advance(5)
    # the captured request again, inside the grace: the nonce was consumed - nothing is rotated, nothing ends
    r = prefresh(rx, out["refresh_token"], dev["device_id"], pr)
    assert r.status_code == 401 and r.json()["code"] == "app_refresh_proof_retry" and r.json()["details"]["reason"] == "nonce"
    # the consumed nonce re-signed over the NEW token: still refused
    pr2 = proof(rx, key, dev["device_id"], t2["refresh_token"], nonce=pr["nonce"])
    assert prefresh(rx, t2["refresh_token"], dev["device_id"], pr2).json()["code"] == "app_refresh_proof_retry"
    assert family_row(rx, out["family_id"])["revoked_at"] is None and token_state(rx, t2["refresh_token"]) == "live"
    r = prefresh(rx, t2["refresh_token"], dev["device_id"], proof(rx, key, dev["device_id"], t2["refresh_token"]))
    assert r.status_code == 200, r.text


def test_a_nonce_of_another_family_is_refused(rx):
    dev, out, key = keyed(rx)
    vdev, _, _ = keyed(rx, "vera", install_id=INSTALL2)
    foreign = nonce_of(rx, vdev["device_id"])
    r = prefresh(rx, out["refresh_token"], dev["device_id"], proof(rx, key, dev["device_id"], out["refresh_token"], nonce=foreign))
    assert r.status_code == 401 and r.json()["details"]["reason"] == "nonce"
    assert family_row(rx, out["family_id"])["revoked_at"] is None


def test_the_key_of_a_previous_registration_no_longer_works(rx):
    dev, out, old_key = keyed(rx)
    register(rx)  # the same install registers again (a reinstall that kept the install id, a new device token)
    assert family_row(rx, out["family_id"])["revoked_reason"] == "device_reregistered"
    new_key = Key()
    r = mint(rx, dev["device_id"], new_key)
    assert r.status_code == 201, r.text
    out2 = r.json()
    assert family_row(rx, out2["family_id"])["device_key_fp"] == new_key.fp != old_key.fp
    # the old family's token with the old key: the family is gone
    assert prefresh(rx, out["refresh_token"], dev["device_id"], proof(rx, old_key, dev["device_id"], out["refresh_token"])).status_code == 401
    # the new family's token signed with the OLD key: a key mismatch - the family ends
    r = prefresh(rx, out2["refresh_token"], dev["device_id"], proof(rx, old_key, dev["device_id"], out2["refresh_token"]))
    assert r.status_code == 401 and family_row(rx, out2["family_id"])["revoked_reason"] == "proof_invalid"


# ---------------------------------------------------------------- nonce lifetime, clock skew

def test_an_expired_nonce_is_a_retry_and_the_token_is_not_consumed(rx):
    dev, out, key = keyed(rx)
    n = nonce_of(rx, dev["device_id"])
    rx.clock.advance(dk.NONCE_TTL_S + 1)
    r = prefresh(rx, out["refresh_token"], dev["device_id"], proof(rx, key, dev["device_id"], out["refresh_token"], nonce=n))
    assert r.status_code == 401 and r.json()["code"] == "app_refresh_proof_retry" and r.json()["details"]["reason"] == "nonce"
    assert r.json()["details"]["server_time"] == now(rx)
    assert token_state(rx, out["refresh_token"]) == "live" and family_row(rx, out["family_id"])["revoked_at"] is None
    r = prefresh(rx, out["refresh_token"], dev["device_id"], proof(rx, key, dev["device_id"], out["refresh_token"]))
    assert r.status_code == 200, r.text


def test_a_clock_off_by_more_than_the_skew_is_a_retry_and_burns_the_nonce(rx):
    dev, out, key = keyed(rx)
    n = nonce_of(rx, dev["device_id"])
    r = prefresh(rx, out["refresh_token"], dev["device_id"], proof(rx, key, dev["device_id"], out["refresh_token"], nonce=n, ts=now(rx) - dk.POP_SKEW_S - 1))
    assert r.status_code == 401 and r.json()["details"] == {"reason": "clock", "server_time": now(rx)}
    r = prefresh(rx, out["refresh_token"], dev["device_id"], proof(rx, key, dev["device_id"], out["refresh_token"], nonce=n))
    assert r.json()["details"]["reason"] == "nonce"  # consumed by the refused try
    assert family_row(rx, out["family_id"])["revoked_at"] is None
    r = prefresh(rx, out["refresh_token"], dev["device_id"], proof(rx, key, dev["device_id"], out["refresh_token"], ts=now(rx) + dk.POP_SKEW_S))
    assert r.status_code == 200, r.text  # inside the skew window


# ---------------------------------------------------------------- the 20 s retry window

def test_the_retry_inside_the_grace_must_prove_possession_too(rx):
    dev, out, key = keyed(rx)
    first = prefresh(rx, out["refresh_token"], dev["device_id"], proof(rx, key, dev["device_id"], out["refresh_token"]))
    assert first.status_code == 200  # ... and the answer is lost on the phone's network
    lost = first.json()
    rx.clock.advance(5)
    retry = prefresh(rx, out["refresh_token"], dev["device_id"], proof(rx, key, dev["device_id"], out["refresh_token"]))  # a fresh nonce, re-signed
    assert retry.status_code == 200, retry.text
    assert token_state(rx, lost["refresh_token"]) == "superseded"
    nxt = retry.json()
    r = prefresh(rx, nxt["refresh_token"], dev["device_id"], proof(rx, key, dev["device_id"], nxt["refresh_token"]))
    assert r.status_code == 200, r.text


def test_a_thief_with_the_parent_inside_the_grace_gets_nothing(rx):
    # security review F-05: today the parent inside the grace hands a pair to whoever presents it; with a key it needs the phone's key
    dev, out, key = keyed(rx)
    assert prefresh(rx, out["refresh_token"], dev["device_id"], proof(rx, key, dev["device_id"], out["refresh_token"])).status_code == 200
    rx.clock.advance(3)
    thief = Key()
    r = prefresh(rx, out["refresh_token"], dev["device_id"], proof(rx, thief, dev["device_id"], out["refresh_token"]))
    assert r.status_code == 401 and "refresh_token" not in r.json()
    assert family_row(rx, out["family_id"])["revoked_reason"] == "proof_invalid"
    # and without any proof (the same parent, inside the grace) the family would have ended as proof_missing: shown on a new family
    dev, out, key = keyed(rx)
    assert prefresh(rx, out["refresh_token"], dev["device_id"], proof(rx, key, dev["device_id"], out["refresh_token"])).status_code == 200
    assert prefresh(rx, out["refresh_token"], dev["device_id"], None).status_code == 401
    assert family_row(rx, out["family_id"])["revoked_reason"] == "proof_missing"


# ---------------------------------------------------------------- the modes

def test_optional_mode_a_keyless_family_needs_no_proof_a_keyed_one_always_does(rx):
    on(rx)
    assert rx.c.get(f"{API}/auth/app/settings").json()["settings"][MODE] == "optional"  # the lab default
    dev = register(rx)
    r = issue(rx, dev["device_id"])  # the slice-1 app: no key
    out = r.json()
    assert r.status_code == 201 and out["device_key"] == {"bound": False} and out["proof_required"] is False
    r = refresh(rx, out["refresh_token"], dev["device_id"])
    assert r.status_code == 200, r.text
    # a proof sent for a keyless family is ignored (an app that has a key but minted without one)
    t = r.json()
    r = prefresh(rx, t["refresh_token"], dev["device_id"], {"nonce": "arxn_" + "a" * 43, "ts": now(rx), "sig": "AAAA"})
    assert r.status_code == 200, r.text


def test_off_mode_binds_no_new_key_but_never_drops_a_bound_one(rx):
    dev, keyed_out, key = keyed(rx)
    switch(rx, **{MODE: "off"})  # from the local channel
    vdev = register(rx, "vera", install_id=INSTALL2)
    r = mint(rx, vdev["device_id"], Key(), user="vera", install_id=INSTALL2)
    assert r.status_code == 201 and r.json()["device_key"] == {"bound": False}
    assert family_row(rx, r.json()["family_id"])["device_key_fp"] is None
    assert refresh(rx, r.json()["refresh_token"], vdev["device_id"], install_id=INSTALL2).status_code == 200
    # the family bound before the switch still needs its proof (no downgrade by a setting)
    assert prefresh(rx, keyed_out["refresh_token"], dev["device_id"], None).status_code == 401
    assert family_row(rx, keyed_out["family_id"])["revoked_reason"] == "proof_missing"


def test_required_mode_refuses_keyless_mints_and_ends_keyless_families(rx):
    on(rx)
    dev = register(rx)
    keyless = issue(rx, dev["device_id"]).json()
    vdev, vout, vkey = keyed(rx, "vera", install_id=INSTALL2)
    body = switch(rx, **{MODE: "required"})
    assert body["families_ended"] == 1 and body["settings"][MODE] == "required"
    assert family_row(rx, keyless["family_id"])["revoked_reason"] == "device_key_required"
    assert whoami(rx, keyless["access_token"]).status_code == 401
    assert family_row(rx, vout["family_id"])["revoked_at"] is None  # the keyed family lives on
    assert whoami(rx, vout["access_token"]).status_code == 200
    r = mint(rx, dev["device_id"], None)
    assert r.status_code == 422 and r.json()["code"] == "device_key_required"
    assert [a["reason"] for a in audit_rows(rx, "auth.app_refresh.issue")][-1] == "device_key_required"
    key = Key()
    r = mint(rx, dev["device_id"], key)
    assert r.status_code == 201 and r.json()["proof_required"] is True
    out = r.json()
    assert prefresh(rx, out["refresh_token"], dev["device_id"], proof(rx, key, dev["device_id"], out["refresh_token"])).status_code == 200


def test_required_mode_also_ends_a_keyless_family_at_its_refresh(rx):
    on(rx)
    dev = register(rx)
    out = issue(rx, dev["device_id"]).json()
    with rx.db.connection() as conn:  # the mode changed without the settings route (a hand-edited row)
        conn.execute("INSERT INTO settings(key, value) VALUES (?, 'required') ON CONFLICT(key) DO UPDATE SET value = excluded.value", (MODE,))
    assert whoami(rx, out["access_token"]).status_code == 401
    assert refresh(rx, out["refresh_token"], dev["device_id"]).status_code == 401
    assert family_row(rx, out["family_id"])["revoked_reason"] == "device_key_required"
    with rx.db.connection() as conn:  # an unknown stored value fails closed
        conn.execute("UPDATE settings SET value = 'maybe' WHERE key = ?", (MODE,))
        assert svc.device_key_mode(conn) == "required"


def test_the_mode_is_validated_and_weakened_only_from_the_local_channel(rx):
    for bad in ("on", "", None, 1):
        assert rx.c.put(f"{API}/auth/app/settings", json={MODE: bad}).status_code == 422, bad
    switch(rx, **{MODE: "required"})  # local: either direction
    joni = rx.user("joni")  # the system administrator on the remote channel
    r = joni.put(f"{ARX}/auth/app/settings", json={MODE: "optional"})
    assert r.status_code == 403 and r.json()["code"] == "local_channel_only", r.text
    switch(rx, **{MODE: "off"})
    r = joni.put(f"{ARX}/auth/app/settings", json={MODE: "required"})  # raising it works from anywhere
    assert r.status_code == 200 and r.json()["settings"][MODE] == "required", r.text
    assert any(a["reason"] == "local_channel_only" for a in audit_rows(rx, "auth.app_refresh.settings"))


# ---------------------------------------------------------------- the mint's key checks

def test_the_mint_refuses_a_bad_key_or_proof_and_keeps_the_previous_family(rx):
    dev, out, key = keyed(rx)
    p384 = ec.generate_private_key(ec.SECP384R1()).public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)
    cases = [
        (key_body(rx, dev["device_id"], key, public_key=dk.b64u_encode(p384)), "device_key_invalid"),
        (key_body(rx, dev["device_id"], key, public_key="A" * 60), "device_key_invalid"),
        ({**key_body(rx, dev["device_id"], key), "proof": {"ts": now(rx), "sig": Key().sign(b"other")}}, "device_key_proof_invalid"),
        (key_body(rx, dev["device_id"], Key(), public_key=key.text), "device_key_proof_invalid"),  # signed by another key
        (key_body(rx, dev["device_id"], key, ts=now(rx) - dk.POP_SKEW_S - 1), "device_key_proof_invalid"),
    ]
    for body, code in cases:
        r = mint(rx, dev["device_id"], None, body=body)
        assert r.status_code == 422 and r.json()["code"] == code, (code, r.text)
    assert family_row(rx, out["family_id"])["revoked_at"] is None  # a refused key replaced nothing
    reasons = [a["reason"] for a in audit_rows(rx, "auth.app_refresh.issue")]
    assert reasons == ["device_key_invalid", "device_key_invalid", "proof_invalid", "proof_invalid", "proof_stale"]
    r = rx.user("dana").post(f"{ARX}/auth/app/refresh-tokens", json={"device_id": dev["device_id"], "install_id": INSTALL,
                                                                    "device_key": {"alg": "RS256", "public_key": key.text, "proof": {"ts": 1, "sig": "AA"}}})
    assert r.status_code == 422  # only ES256


def test_one_key_belongs_to_one_device(rx):
    dev, out, key = keyed(rx)
    dev2 = register(rx, "dana", install_id=INSTALL2, name="טלפון שני")
    r = mint(rx, dev2["device_id"], key, install_id=INSTALL2)
    assert r.status_code == 409 and r.json()["code"] == "device_key_in_use"
    assert mint(rx, dev["device_id"], key).status_code == 201  # the same device re-mints with its own key (the rotation path)


# ---------------------------------------------------------------- the challenge route

def test_the_challenge_is_absent_while_off_or_local_and_shapeless_for_strangers(rx):
    assert challenge(rx, "dev_whatever0000").status_code == 404  # the switch is off
    dev, out, key = keyed(rx)
    assert challenge(rx, dev["device_id"], prefix=API).status_code == 404  # the local channel
    known = challenge(rx, dev["device_id"]).json()
    stranger = challenge(rx, "dev_unknown00000000").json()
    assert set(known) == set(stranger) == {"nonce", "expires_in", "expires_at", "server_time"}
    assert known["expires_in"] == dk.NONCE_TTL_S and stranger["nonce"].startswith("arxn_")
    with rx.db.connection(mode="read") as conn:
        stored = {r["nonce_hash"] for r in conn.execute("SELECT nonce_hash FROM app_refresh_nonces").fetchall()}
    assert dk.nonce_hash(known["nonce"]) in stored and dk.nonce_hash(stranger["nonce"]) not in stored and len(stored) == 1


def test_challenges_are_rate_limited_per_family_and_bounded_in_number(rx):
    dev, out, key = keyed(rx)
    for _ in range(svc.RATE_CHALLENGE[0]):
        assert challenge(rx, dev["device_id"]).status_code == 200
    assert challenge(rx, dev["device_id"]).status_code == 429
    with rx.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM app_refresh_nonces WHERE family_id = ?", (out["family_id"],)).fetchone()[0] == dk.MAX_OPEN_NONCES
    for i in range(svc.FAILURES_PER_MIN):  # strangers count on the client's failure tier
        assert challenge(rx, f"dev_unknown{i:08d}").status_code == 200
    assert challenge(rx, "dev_unknown_last00").status_code == 429


def test_ending_a_family_drops_its_nonces_and_the_janitor_drops_stale_ones(rx):
    dev, out, key = keyed(rx)
    nonce_of(rx, dev["device_id"])
    rx.clock.advance(dk.NONCE_TTL_S + 1)
    svc.janitor(rx.db)
    with rx.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM app_refresh_nonces").fetchone()[0] == 0
    nonce_of(rx, dev["device_id"])
    assert rx.user("dana").delete(f"{ARX}/auth/app/families/{out['family_id']}").status_code == 204
    with rx.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM app_refresh_nonces").fetchone()[0] == 0


# ---------------------------------------------------------------- no key material in the audit, the log or the tables

def test_the_audit_and_the_log_carry_no_key_material(rx, caplog):
    caplog.set_level(logging.DEBUG)
    dev, out, key = keyed(rx)
    t = prefresh(rx, out["refresh_token"], dev["device_id"], proof(rx, key, dev["device_id"], out["refresh_token"])).json()
    prefresh(rx, t["refresh_token"], dev["device_id"], proof(rx, Key(), dev["device_id"], t["refresh_token"]))  # wrong key: refused, audited
    mint(rx, dev["device_id"], None, body=key_body(rx, dev["device_id"], Key(), public_key=key.text))  # a refused mint, audited
    issued = audit_rows(rx, "auth.app_refresh.issued")
    details = json.loads(issued[0]["details_json"])
    assert details["device_key"] == "ES256" and details["key_fp"] == key.fp[:16] and len(details["key_fp"]) == 16
    with rx.db.connection(mode="read") as conn:
        audit_text = json.dumps([[str(v) for v in tuple(r)] for r in conn.execute("SELECT * FROM audit_log").fetchall()], ensure_ascii=False)
        tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'").fetchall()]
        all_text = "\n".join(json.dumps([str(v) for v in tuple(r)], ensure_ascii=False) for tb in tables for r in conn.execute(f'SELECT * FROM "{tb}"').fetchall())
    spki_text = dk.b64u_encode(key.spki)
    secrets_ = [key.text, spki_text, key.fp, *key.sigs, *rx.nonces]
    for s in secrets_:
        assert s not in audit_text and s not in caplog.text
    for n in rx.nonces:  # nonces: only their hashes are stored
        assert n not in all_text
    assert "arxn_" not in all_text
    assert_no_material(rx)


def test_backup_and_migration(rx):
    assert "app_refresh_nonces" in backup.NEVER_EXPORTED_TABLES and MODE in backup.SETTINGS_KEEP
    assert set(svc.SETTING_KEYS) <= backup.SETTINGS_KEEP
    with rx.db.connection(mode="read") as conn:
        cols = {r["name"] for r in conn.execute("PRAGMA table_info(app_refresh_families)").fetchall()}
    assert {"device_key_spki", "device_key_fp", "device_key_alg", "device_key_bound_at"} <= cols


def test_the_signed_strings_are_exactly_the_documented_ones():
    # the contract in APPREFRESH-DEVICEKEY-SPEC.md section 4: the mobile teams test their signer against these bytes
    assert dk.refresh_message("dev_a", "arxn_n", 1900000000, "arxr_t") == (
        b"arx-app-pop-v1\nrefresh\ndev_a\narxn_n\n1900000000\n" + dk.token_digest("arxr_t").encode())
    assert dk.token_digest("arxr_t") == dk.b64u_encode(__import__("hashlib").sha256(b"arxr_t").digest()) and "=" not in dk.token_digest("arxr_t")
    assert dk.mint_message("dev_a", 1900000000, "PUBKEY") == b"arx-app-pop-v1\nmint\ndev_a\n-\n1900000000\nPUBKEY"
