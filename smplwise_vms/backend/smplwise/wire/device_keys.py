"""Response models of the phone key routes (routers/device_keys.py, `/api/v1/auth/device-keys...`; MFA-DEVICEKEY-2490, slice 8 of the
second-factor train). Never key material: a key is described by its id, label, auth kind, platform and dates."""
from __future__ import annotations

from typing import Literal

from . import WireModel

# every route answers JSON
NO_JSON: frozenset[str] = frozenset()

AuthKind = Literal["biometric", "biometric_or_screen_lock"]


class DeviceKeyChallenge(WireModel):
    """`POST /auth/device-keys/challenge`: the exact text the app signs (`payload`, UTF-8), its single-use id, how long it lives, and
    which auth kinds a new key may declare (`security.device_key_auth`)."""
    challenge_id: str
    purpose: Literal["register", "step_up"]
    payload: str
    expires_in: int
    auth_kind: AuthKind
    allowed_auth_kinds: list[AuthKind]


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
    """One active phone key of the caller. `attested` is `not_checked` until the attestation slice (DEVICEKEY-ATTEST)."""
    id: str
    label: str
    auth_kind: AuthKind
    platform: Literal["android"]
    created_at: str
    last_used_at: str | None
    attested: Literal["not_checked"]


class DeviceKeyList(WireModel):
    """`GET /auth/device-keys`: the caller's active keys, the installation's auth-kind setting and the per-user maximum."""
    keys: list[DeviceKeyRow]
    auth_kind: AuthKind
    max: int


class DeviceKeyRevoked(WireModel):
    """`DELETE /auth/device-keys/{id}`: the key is revoked (its row is kept for the audit trail)."""
    id: str
    revoked: bool
