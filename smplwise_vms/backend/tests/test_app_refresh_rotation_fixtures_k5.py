"""MOBILE-CONTRACT-V22-2380, K-5 (contract v2.2 section 11; docs/changes/APPREFRESH-DEVICEKEY-SPEC.md sections 4, 6, 6a): the proof for
the app teams that replacing the saved sign-in's device key needs the OLD key, as the official JSON fixtures of every case - produced by
driving the REAL routes (the fake HA core and the simulated phone key of test_app_refresh_devicekey_295.py) and checked in under
`contracts/fixtures/device_key_rotation/` - plus `replace_vector.json`, a fixed TEST public key with a replace message and a signature over it
that the server's verifier accepts (a client's own message builder and verifier can be checked against it byte for byte).

Every fixture test builds its fixture from a live request / answer and compares it with the checked-in file, so a change of status, error
code, `details.reason`, field set or envelope fails here (code and contract drifted). To regenerate after an INTENDED change:
`ARX_WRITE_FIXTURES=1 python -m pytest tests/test_app_refresh_rotation_fixtures_k5.py` (then review the diff and update the contract text).
Secrets never reach a fixture: tokens, nonces, signatures, public keys, ids and instants are placeholders, each format-checked first.
The vector holds a public key and a signature only - its private half was thrown away when the vector was written. Fakes only: no Home
Assistant, no phone, no lab value."""
from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any

from test_app_refresh_295 import ARX, INSTALL, family_row, rx  # noqa: F401 - rx is the shared fixture
from test_app_refresh_devicekey_295 import Key, key_body, keyed, nonce_of, now
from test_app_session_fixtures_sx25 import CID, Subs, _dump, fixture

from smplwise.services import app_refresh_key as dk

FIX = Path(__file__).resolve().parents[3] / "contracts" / "fixtures" / "device_key_rotation"
WRITE = os.environ.get("ARX_WRITE_FIXTURES") == "1"
MINT = f"{ARX}/auth/app/refresh-tokens"
CHALLENGE = f"{ARX}/auth/app/refresh-challenge"
MINT_HEADERS = {"Content-Type": "application/json", "Cookie": "<SESSION_COOKIE>", "Origin": "<ORIGIN>", "X-Correlation-Id": CID}
B64U = r"[A-Za-z0-9_-]{40,}"

PLACEHOLDERS = {
    "<DEVICE_ID>": "`dev_` + 16 lowercase hex: the device registration (`POST presence/devices`)",
    "<INSTALL_ID>": "the install id that registration holds (8-64 characters)",
    "<SESSION_COOKIE>": "the web view's Arx session cookie from a sign-in at most 15 minutes old (the app's native call carries it)",
    "<ORIGIN>": "`<scheme>://<host[:port]>` of the server, exactly as the app stored it (contract section 0)",
    "<NEW_PUBLIC_KEY>": "base64url of the NEW key's SPKI DER (Android) or 65-byte X9.63 point (iOS)",
    "<OLD_PUBLIC_KEY>": "base64url of the key the device is pinned to",
    "<NEW_KEY_SIGNATURE>": "base64url ES256 signature by the NEW key over the `mint` message",
    "<OLD_KEY_SIGNATURE>": "base64url ES256 signature by the OLD (pinned) key over the `replace` message",
    "<PINNED_KEY_MINT_SIGNATURE>": "base64url ES256 signature by the pinned key itself over the `mint` message (the same key again)",
    "<OTHER_KEY_SIGNATURE>":"base64url ES256 signature by a key that is not the pinned one",
    "<NONCE>": "`arxn_` + 43 base64url from `POST /auth/app/refresh-challenge`, single use, 120 s",
    "<UNKNOWN_NONCE>": "a nonce-shaped value the server never issued",
    "<UNIX_SECONDS>": "a JSON integer, Unix seconds (UTC)",
    "<UNIX_SECONDS_SKEWED>": "a JSON integer more than 300 s away from the server clock",
    "<ISO_8601_UTC>": "`YYYY-MM-DDTHH:MM:SSZ`",
    "<FAMILY_ID>": "`arf_` + 16 lowercase hex: the saved sign-in",
    "<REFRESH_TOKEN>": "`arxr_` + base64url (Keychain / Keystore only, never logged)",
    "<ACCESS_TOKEN>": "`arxa_` + base64url (minutes, never logged)",
    "<SERVER_CORRELATION_ID>": "the server's own correlation id (12 lowercase hex)",
}


# ---------------------------------------------------------------- helpers

def _subs(dev: dict, new: Key | None = None, old: Key | None = None) -> Subs:
    s = Subs()
    s.add(dev["device_id"], "<DEVICE_ID>", r"dev_[0-9a-f]{16}")
    s.add(INSTALL, "<INSTALL_ID>")
    if new is not None:
        s.add(new.text, "<NEW_PUBLIC_KEY>", B64U)
    if old is not None:
        s.add(old.text, "<OLD_PUBLIC_KEY>", B64U)
    return s


def _body_with_replace(rx, s: Subs, dev: dict, new: Key, signer: Key, *, nonce: str | None = None, ts: int | None = None,
                       nonce_ph: str = "<NONCE>", ts_ph: str = "<UNIX_SECONDS>", sig_ph: str = "<OLD_KEY_SIGNATURE>") -> dict:
    kb = key_body(rx, dev["device_id"], new)
    s.add(kb["proof"]["sig"], "<NEW_KEY_SIGNATURE>", B64U)
    s.add(kb["proof"]["ts"], "<UNIX_SECONDS>")
    nonce = nonce or nonce_of(rx, dev["device_id"])
    ts = now(rx) if ts is None else ts
    sig = signer.sign(dk.replace_message(dev["device_id"], nonce, ts, kb["public_key"]))
    s.add(nonce, nonce_ph, r"arxn_[A-Za-z0-9_-]{20,}")
    s.add(ts, ts_ph)
    s.add(sig, sig_ph, B64U)
    kb["replaces"] = {"nonce": nonce, "ts": ts, "sig": sig}
    return {"device_id": dev["device_id"], "install_id": INSTALL, "device_key": kb}


def _mint(rx, body: dict):
    r = rx.user("dana").post(MINT, content=json.dumps(body), headers={"Content-Type": "application/json", "X-Correlation-Id": CID})
    if r.status_code == 401:
        r = rx.user("dana", fresh=True).post(MINT, content=json.dumps(body), headers={"Content-Type": "application/json", "X-Correlation-Id": CID})
    return r


def _ok_subs(s: Subs, r) -> None:
    out = r.json()
    s.add(out["family_id"], "<FAMILY_ID>", r"arf_[0-9a-f]{16}")
    s.add(out["refresh_token"], "<REFRESH_TOKEN>", r"arxr_[A-Za-z0-9_-]{20,}")
    s.add(out["access_token"], "<ACCESS_TOKEN>", r"arxa_[A-Za-z0-9_-]{20,}")


def check(fx: dict[str, Any]) -> None:
    text = _dump(fx)
    for prefix in ("arxa_", "arxr_", "arxn_", "arxd_", "arf_"):
        assert re.search(re.escape(prefix) + r"[A-Za-z0-9_-]{8,}", text) is None, (fx["name"], prefix)
    assert re.search(r"[A-Za-z0-9_-]{60,}", text) is None, (fx["name"], "key or signature material")
    path = FIX / f"{fx['name']}.json"
    if WRITE:
        FIX.mkdir(parents=True, exist_ok=True)
        path.write_bytes(text.encode("utf-8"))
        return
    assert path.exists(), f"missing fixture {path.name}: run with ARX_WRITE_FIXTURES=1 and review"
    assert json.loads(path.read_text(encoding="utf-8")) == fx, f"{path.name}: the code and the checked-in fixture drifted"


def _refused(rx, name: str, description: str, body: dict, s: Subs, reason: str, family_id: str) -> None:
    r = _mint(rx, body)
    assert r.status_code == 409 and r.json()["code"] == "device_key_bound" and r.json()["details"]["reason"] == reason, r.text
    assert family_row(rx, family_id)["revoked_at"] is None  # a refusal ends nothing
    check(fixture(name, description, "POST", MINT, MINT_HEADERS, body, r, s))


# ---------------------------------------------------------------- the cases of contract section 11

def test_challenge_for_a_replace(rx):
    dev, _, old = keyed(rx)
    s = _subs(dev)
    body = {"device_id": dev["device_id"]}
    r = rx.c.post(CHALLENGE, content=json.dumps(body), headers={"Content-Type": "application/json", "X-Correlation-Id": CID})
    assert r.status_code == 200, r.text
    s.add(r.json()["nonce"], "<NONCE>", r"arxn_[A-Za-z0-9_-]{43}")
    assert r.json()["expires_in"] == dk.NONCE_TTL_S
    check(fixture("challenge_ok", "200: a single-use nonce (120 s) for the device; the OLD key signs the replace message over it. No cookie.",
                  "POST", CHALLENGE, {"Content-Type": "application/json", "X-Correlation-Id": CID}, body, r, s))


def test_rotation_with_the_old_keys_proof(rx):
    dev, out, old = keyed(rx)
    new = Key()
    s = _subs(dev, new)
    body = _body_with_replace(rx, s, dev, new, old)
    r = _mint(rx, body)
    assert r.status_code == 201, r.text
    assert family_row(rx, out["family_id"])["revoked_reason"] == "replaced" and family_row(rx, r.json()["family_id"])["device_key_fp"] == new.fp
    _ok_subs(s, r)
    check(fixture("mint_replace_ok", "201: the device moves to the NEW key with the OLD key's consent; the previous sign-in ends (`replaced`).",
                  "POST", MINT, MINT_HEADERS, body, r, s))


def test_rotation_without_replaces_is_refused_missing(rx):
    dev, out, _ = keyed(rx)
    new = Key()
    s = _subs(dev, new)
    kb = key_body(rx, dev["device_id"], new)
    s.add(kb["proof"]["sig"], "<NEW_KEY_SIGNATURE>", B64U)
    s.add(kb["proof"]["ts"], "<UNIX_SECONDS>")
    body = {"device_id": dev["device_id"], "install_id": INSTALL, "device_key": kb}
    _refused(rx, "mint_replace_missing", "409 device_key_bound, reason missing: a new key without the old key's consent; nothing ends. "
             "Holding the old key: challenge, sign the replace message, mint again. Without it: ask the administrator.", body, s, "missing", out["family_id"])


def test_rotation_with_an_unknown_nonce_is_refused_nonce(rx):
    dev, out, old = keyed(rx)
    new = Key()
    s = _subs(dev, new)
    body = _body_with_replace(rx, s, dev, new, old, nonce="arxn_" + "A" * 43, nonce_ph="<UNKNOWN_NONCE>")
    _refused(rx, "mint_replace_nonce", "409 device_key_bound, reason nonce: the nonce is unknown, used, expired or another device's; "
             "get a new challenge and retry once.", body, s, "nonce", out["family_id"])


def test_rotation_signed_by_the_new_key_is_refused_invalid(rx):
    dev, out, _ = keyed(rx)
    new = Key()
    s = _subs(dev, new)
    body = _body_with_replace(rx, s, dev, new, new, sig_ph="<OTHER_KEY_SIGNATURE>")
    _refused(rx, "mint_replace_invalid", "409 device_key_bound, reason invalid: not the pinned key's signature over exactly this replace "
             "message (here: signed by the new key itself). The nonce is spent.", body, s, "invalid", out["family_id"])


def test_rotation_with_a_skewed_clock_is_refused_clock(rx):
    dev, out, old = keyed(rx)
    new = Key()
    s = _subs(dev, new)
    body = _body_with_replace(rx, s, dev, new, old, ts=now(rx) - dk.POP_SKEW_S - 1, ts_ph="<UNIX_SECONDS_SKEWED>")
    _refused(rx, "mint_replace_clock", "409 device_key_bound, reason clock: replaces.ts is more than 300 s from details.server_time; the "
             "nonce is spent. New challenge, sign with the corrected time, retry once.", body, s, "clock", out["family_id"])


def test_the_same_key_again_needs_no_replaces(rx):
    dev, out, old = keyed(rx)
    s = _subs(dev, old=old)
    kb = key_body(rx, dev["device_id"], old)
    s.add(kb["proof"]["sig"], "<PINNED_KEY_MINT_SIGNATURE>", B64U)
    s.add(kb["proof"]["ts"], "<UNIX_SECONDS>")
    body = {"device_id": dev["device_id"], "install_id": INSTALL, "device_key": kb}
    r = _mint(rx, body)
    assert r.status_code == 201, r.text
    _ok_subs(s, r)
    fx = fixture("mint_same_key_ok", "201: the pinned key minted again (a new sign-in of the same phone) needs no replaces.", "POST", MINT,
                 MINT_HEADERS, body, r, s)
    check(fx)


def test_the_index_lists_every_case_and_every_placeholder():
    names = sorted(p.stem for p in FIX.glob("*.json") if p.stem not in ("index", "replace_vector"))
    index = {
        "contract": "docs/api/mobile-presence-contract.md section 11 (v2.2); docs/changes/APPREFRESH-DEVICEKEY-SPEC.md sections 4, 6, 6a",
        "generated_by": "smplwise_vms/backend/tests/test_app_refresh_rotation_fixtures_k5.py (ARX_WRITE_FIXTURES=1)",
        "status": "FIXTURES: a passing client test against these files proves the client's parsing and byte layout, not the server, a device or an activation",
        "cases": names,
        "placeholders": PLACEHOLDERS,
        "vector": "replace_vector.json",
    }
    if WRITE:
        (FIX / "index.json").write_bytes(_dump(index).encode("utf-8"))
        return
    assert json.loads((FIX / "index.json").read_text(encoding="utf-8")) == index
    assert names == ["challenge_ok", "mint_replace_clock", "mint_replace_invalid", "mint_replace_missing", "mint_replace_nonce", "mint_replace_ok", "mint_same_key_ok"]
    used = set()
    for n in names:
        used |= set(re.findall(r"<[A-Z_0-9]+>", (FIX / f"{n}.json").read_text(encoding="utf-8")))
    assert used <= set(PLACEHOLDERS), used - set(PLACEHOLDERS)


# ---------------------------------------------------------------- the verification vector

VECTOR_FIELDS = {"device_id": "dev_0123456789abcdef", "nonce": "arxn_" + "TestVectorNonce0" * 2 + "TestVectorN", "ts": 1900000000}


def test_the_replace_vector_verifies_and_its_message_is_byte_exact():
    path = FIX / "replace_vector.json"
    if WRITE:
        old, new = Key(), Key(x963=True)  # the private halves exist only in this process; only the public keys are written
        msg = dk.replace_message(VECTOR_FIELDS["device_id"], VECTOR_FIELDS["nonce"], VECTOR_FIELDS["ts"], new.text)
        vec = {"what": "K-5 replace proof: the OLD key's ES256 signature over the replace message (contract v2.2 section 11). TEST VALUES - "
                       "no real device, nonce or key; the private halves were never stored.",
               **VECTOR_FIELDS, "old_public_key_spki_b64u": old.text, "new_public_key": new.text,
               "message_utf8": msg.decode("utf-8"), "message_b64u": dk.b64u_encode(msg), "sig_der_b64u": old.sign(msg)}
        path.write_bytes(_dump(vec).encode("utf-8"))
    vec = json.loads(path.read_text(encoding="utf-8"))
    msg = dk.replace_message(vec["device_id"], vec["nonce"], vec["ts"], vec["new_public_key"])
    assert {k: vec[k] for k in VECTOR_FIELDS} == VECTOR_FIELDS
    assert vec["message_utf8"].encode("utf-8") == msg and dk.b64u_decode(vec["message_b64u"]) == msg
    assert msg.count(b"\n") == 5 and not msg.endswith(b"\n") and msg.startswith(b"arx-app-pop-v1\nreplace\n")
    old_spki, _ = dk.parse_public_key(vec["old_public_key_spki_b64u"])
    new_spki, _ = dk.parse_public_key(vec["new_public_key"])  # the new key in the iOS X9.63 form also parses
    assert dk.verify(old_spki, vec["sig_der_b64u"], msg)
    assert not dk.verify(new_spki, vec["sig_der_b64u"], msg)  # the NEW key cannot consent for itself
    assert not dk.verify(old_spki, vec["sig_der_b64u"], msg + b"x")  # one byte more: refused
    other = dk.replace_message(vec["device_id"], vec["nonce"], vec["ts"] + 1, vec["new_public_key"])
    assert not dk.verify(old_spki, vec["sig_der_b64u"], other)
