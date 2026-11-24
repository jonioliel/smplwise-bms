"""Response models of the phone key routes (routers/device_keys.py, `/api/v1/auth/device-keys...`; MFA-DEVICEKEY-2490, slice 8 of the
second-factor train). Never key material: a key is described by its id, label, auth kind, platform and dates."""
from __future__ import annotations

from typing import Literal

from . import WireModel

# every route answers JSON
NO_JSON: frozenset[str] = frozenset()

AuthKind = Literal["biometric", "biometric_or_screen_lock"]
# MFA-DEVICEKEY-ATTEST-2490 (owner Q52): `security.device_key_attestation` and the verdict kept per key (services/device_key_attestation.py)
AttestationMode = Literal["off", "preferred", "required"]
Attested = Literal["hardware", "software", "none", "failed", "not_checked"]


class DeviceKeyChallenge(WireModel):
    """`POST /auth/device-keys/challenge`: the exact text the app signs (`payload`, UTF-8), its single-use id, how long it lives, and
    which auth kinds a new key may declare (`security.device_key_auth`). `attestation`: the installation's attestation mode; for a
    `register` challenge the app attests the new key with `setAttestationChallenge(SHA-256(payload))` and sends the chain."""
    challenge_id: str
    purpose: Literal["register", "step_up"]
    payload: str
    expires_in: int
    auth_kind: AuthKind
    allowed_auth_kinds: list[AuthKind]
    attestation: AttestationMode


class DeviceKeySignInChallenge(WireModel):
    """`POST /auth/device-keys/sign-in/challenge` (public): the text to sign for the sign-in factor; the answer goes in `header` as
    `<answer_prefix><challenge_id>:<signature>`."""
    challenge_id: str
    purpose: Literal["sign_in"]
    payload: str
    expires_in: int
    answer_prefix: str
    header: str


class DeviceKeyRow(WireModel):
    """One active phone key of the caller. `attested`: the verdict of the Android key attestation made at registration (`not_checked`:
    registered before slice 9 or while the mode was off). `counts`: whether the key is usable under the current mode (False only under
    `required` for a key that is not `hardware`: register it again)."""
    id: str
    label: str
    auth_kind: AuthKind
    platform: Literal["android"]
    created_at: str
    last_used_at: str | None
    attested: Attested
    counts: bool


class DeviceKeyList(WireModel):
    """`GET /auth/device-keys`: the caller's active keys, the installation's auth-kind and attestation settings and the per-user maximum."""
    keys: list[DeviceKeyRow]
    auth_kind: AuthKind
    attestation: AttestationMode
    max: int


class DeviceKeyRevoked(WireModel):
    """`DELETE /auth/device-keys/{id}`: the key is revoked (its row is kept for the audit trail)."""
    id: str
    revoked: bool
