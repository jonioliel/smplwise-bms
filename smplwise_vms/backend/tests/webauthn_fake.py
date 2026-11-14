"""A software WebAuthn authenticator for tests (USR2 phase 4). No real device exists here: keys are generated per test with
`cryptography`, and the authenticator answers creation / request options exactly as a browser's PublicKeyCredential.toJSON() would,
with knobs to break every part a relying party must check (origin, RP id, challenge, flags, counter, signature, user handle)."""
from __future__ import annotations

import base64
import hashlib
import json
import os
import struct
from typing import Any

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec, padding, rsa


def b64u(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode("ascii")


def unb64u(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def cbor(v: Any) -> bytes:
    """A minimal CBOR encoder (definite lengths) for the fake's own messages."""

    def head(major: int, n: int) -> bytes:
        if n < 24:
            return bytes([(major << 5) | n])
        for ai, size in ((24, 1), (25, 2), (26, 4), (27, 8)):
            if n < (1 << (8 * size)):
                return bytes([(major << 5) | ai]) + n.to_bytes(size, "big")
        raise ValueError(n)

    if v is False:
        return b"\xf4"
    if v is True:
        return b"\xf5"
    if v is None:
        return b"\xf6"
    if isinstance(v, int):
        return head(0, v) if v >= 0 else head(1, -1 - v)
    if isinstance(v, bytes):
        return head(2, len(v)) + v
    if isinstance(v, str):
        raw = v.encode("utf-8")
        return head(3, len(raw)) + raw
    if isinstance(v, list):
        return head(4, len(v)) + b"".join(cbor(x) for x in v)
    if isinstance(v, dict):
        return head(5, len(v)) + b"".join(cbor(k) + cbor(x) for k, x in v.items())
    raise TypeError(type(v))


class FakeAuthenticator:
    def __init__(self, *, alg: int = -7, origin: str = "https://arx.example.com", rp_id: str = "arx.example.com", uv: bool = True,
                 counter: int = 0, backup_eligible: bool = False, counting: bool = True) -> None:
        self.counting = counting  # False: an authenticator without a counter (synced passkeys report 0 forever)
        self.alg = alg
        self.origin = origin
        self.rp_id = rp_id
        self.uv = uv
        self.counter = counter
        self.be = backup_eligible
        self.credential_id = os.urandom(32)
        self.user_handle: bytes | None = None
        if alg == -7:
            self.key = ec.generate_private_key(ec.SECP256R1())
        else:
            self.key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

    def cose(self) -> bytes:
        if self.alg == -7:
            nums = self.key.public_key().public_numbers()
            return cbor({1: 2, 3: -7, -1: 1, -2: nums.x.to_bytes(32, "big"), -3: nums.y.to_bytes(32, "big")})
        nums = self.key.public_key().public_numbers()
        return cbor({1: 3, 3: -257, -1: nums.n.to_bytes(256, "big"), -2: nums.e.to_bytes(3, "big")})

    def _flags(self, *, up: bool, uv: bool, at: bool) -> int:
        return (0x01 if up else 0) | (0x04 if uv else 0) | (0x08 if self.be else 0) | (0x10 if self.be else 0) | (0x40 if at else 0)

    def _client_data(self, kind: str, challenge: str, origin: str | None, extra: dict | None = None) -> bytes:
        return json.dumps({"type": kind, "challenge": challenge, "origin": origin or self.origin, "crossOrigin": False, **(extra or {})},
                          separators=(",", ":")).encode()

    def _sign(self, data: bytes) -> bytes:
        if self.alg == -7:
            return self.key.sign(data, ec.ECDSA(hashes.SHA256()))
        return self.key.sign(data, padding.PKCS1v15(), hashes.SHA256())

    def create(self, options: dict, *, origin: str | None = None, rp_id: str | None = None, uv: bool | None = None, up: bool = True,
               challenge: str | None = None, fmt: str = "none", kind: str = "webauthn.create", raw_id: bytes | None = None) -> dict:
        pk = options["publicKey"]
        self.user_handle = unb64u(pk["user"]["id"])
        rp = rp_id or pk["rp"]["id"]
        cd = self._client_data(kind, challenge or pk["challenge"], origin)
        auth = (hashlib.sha256(rp.encode()).digest() + bytes([self._flags(up=up, uv=self.uv if uv is None else uv, at=True)])
                + struct.pack(">I", self.counter) + b"\x00" * 16 + struct.pack(">H", len(self.credential_id)) + self.credential_id + self.cose())
        att = cbor({"fmt": fmt, "attStmt": {}, "authData": auth})
        rid = raw_id or self.credential_id
        return {"id": b64u(rid), "rawId": b64u(rid), "type": "public-key",
                "response": {"clientDataJSON": b64u(cd), "attestationObject": b64u(att), "transports": ["internal", "hybrid"]}}

    def get(self, options: dict, *, origin: str | None = None, rp_id: str | None = None, uv: bool | None = None, up: bool = True,
            counter: int | None = None, challenge: str | None = None, user_handle: bytes | None | str = "own", tamper: bool = False,
            kind: str = "webauthn.get", extra_client_data: dict | None = None) -> dict:
        pk = options["publicKey"]
        rp = rp_id or pk.get("rpId") or self.rp_id
        if counter is None:
            if self.counting:
                self.counter += 1
            counter = self.counter
        cd = self._client_data(kind, challenge or pk["challenge"], origin, extra_client_data)
        auth = hashlib.sha256(rp.encode()).digest() + bytes([self._flags(up=up, uv=self.uv if uv is None else uv, at=False)]) + struct.pack(">I", counter)
        sig = self._sign(auth + hashlib.sha256(cd).digest())
        if tamper:
            sig = self._sign(auth + hashlib.sha256(cd + b" ").digest())
        resp: dict[str, Any] = {"clientDataJSON": b64u(cd), "authenticatorData": b64u(auth), "signature": b64u(sig)}
        uh = self.user_handle if user_handle == "own" else user_handle
        if uh:
            resp["userHandle"] = b64u(uh)
        return {"id": b64u(self.credential_id), "rawId": b64u(self.credential_id), "type": "public-key", "response": resp}
